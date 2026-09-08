import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadGamePolicy } from "../../../src/app/game-policy.ts";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { publishDevelopmentContent } from "../../../src/infrastructure/postgres/publish-development-content.ts";
import { CatalogModule } from "../../../src/modules/catalog/catalog-module.ts";
import { CharacterModule } from "../../../src/modules/character/character-module.ts";
import { CharacterNotFoundError } from "../../../src/modules/character/domain/character-not-found-error.ts";
import { ExperienceGrantConflictError } from "../../../src/modules/character/domain/experience-grant-conflict-error.ts";
import { InvalidExperienceGrantError } from "../../../src/modules/character/domain/invalid-experience-grant-error.ts";
import { ProgressionLimitError } from "../../../src/modules/character/domain/progression-limit-error.ts";
import { IdentityModule } from "../../../src/modules/identity/identity-module.ts";
import { InventoryModule } from "../../../src/modules/inventory/inventory-module.ts";
import { uniqueDevelopmentSlot } from "../../support/harness/unique-development-slot.ts";
import { playableCharacterModuleInput } from "../../support/playable-character-module-input.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";
import { SystemClock } from "../../../src/shared/kernel/system-clock.ts";

const databaseUrl = requireTestDatabaseUrl();
const policy = loadGamePolicy(path.resolve(process.cwd(), "config/development.json"));

describe("experience grants", () => {
  let database: PostgresDatabase;
  let identity: IdentityModule;
  let characters: CharacterModule;
  let inventory: InventoryModule;
  let catalog: CatalogModule;

  beforeAll(async () => {
    await publishDevelopmentContent(
      databaseUrl,
      path.resolve(process.cwd(), "content/playable-slice.json"),
    );
    database = new PostgresDatabase(databaseUrl);
    identity = IdentityModule.create({ database, clock: new SystemClock() });
    catalog = await CatalogModule.create({ database });
    inventory = InventoryModule.create({
      database,
      starterItems: policy.starterItems,
      releaseArtifacts: catalog.releaseArtifacts,
      catalog: catalog.catalog,
      bagCapacity: policy.bootstrap.bagCapacity,
    });
    characters = CharacterModule.create(
      playableCharacterModuleInput(database, catalog.progression, inventory.service, {
        creationPolicy: policy.heroCreation,
      }),
    );
  });

  afterAll(async () => {
    await identity.close();
    await characters.close();
    await inventory.close();
    await catalog.close();
    await database.close();
  });

  it("applies no-level, boundary, multi-level and L8 grants atomically", async () => {
    const hero = await createHero();
    const noLevel = await characters.service.grantExperience({
      characterId: hero.id,
      operationId: `test:${hero.id}:nolevel`,
      amount: 10,
    });
    expect(noLevel).toMatchObject({
      expBefore: 1,
      expAfter: 11,
      levelBefore: 1,
      levelAfter: 1,
      levelsGained: 0,
    });
    const boundary = await characters.service.grantExperience({
      characterId: hero.id,
      operationId: `test:${hero.id}:boundary`,
      amount: 57,
    });
    expect(boundary).toMatchObject({ expAfter: 68, levelAfter: 2, levelsGained: 1 });
    const multi = await characters.service.grantExperience({
      characterId: hero.id,
      operationId: `test:${hero.id}:multi`,
      amount: 405,
    });
    expect(multi).toMatchObject({ expAfter: 473, levelAfter: 4, levelsGained: 2 });
    const stored = await characters.service.getByAccountId(hero.accountId);
    if (!stored) throw new Error("Hero disappeared");
    expect(stored).toMatchObject({ exp: 473, level: 4, hp: 13, maxHp: 13, mp: 16, maxMp: 16 });
    const skills = await characters.service.skillsFor(hero.accountId);
    expect(skills.find((skill) => skill.id === "VIT")?.value).toBe(13);
    expect(skills.find((skill) => skill.id === "HPREG")?.value).toBe(700);
  });

  it("keeps zero HP at zero and scales equipped maxima once", async () => {
    const hero = await createHero();
    hero.takeDamage(10);
    await characters.service.save(hero);
    await database.run(async () => {
      const locked = await characters.service.lockByAccountId(hero.accountId);
      const items = await inventory.service.list(locked.id);
      const glove = items[0];
      if (!glove) throw new Error("Starter glove is missing");
      const definition = await catalog.catalog.artifact(glove.artifactId);
      if (!definition) throw new Error("Glove definition is missing");
      await inventory.service.putOn(locked, glove.id, definition);
      const snapshot = await catalog.progression.progressionSnapshot();
      await characters.service.applyEquipmentVitals(
        locked,
        await inventory.service.modifiersForHero(locked.id, snapshot.contentReleaseId),
      );
    });
    const granted = await characters.service.grantExperience({
      characterId: hero.id,
      operationId: `test:${hero.id}:zero-hp`,
      amount: 472,
    });
    expect(granted.levelAfter).toBe(4);
    const stored = await characters.service.getByAccountId(hero.accountId);
    if (!stored) throw new Error("Hero disappeared");
    expect(stored.hp).toBe(0);
    expect(stored.maxHp).toBe(18);
    expect(stored.maxMp).toBe(16);
  });

  it("returns the persisted result for retries and rejects conflicting reuse", async () => {
    const hero = await createHero();
    const first = await characters.service.grantExperience({
      characterId: hero.id,
      operationId: `test:${hero.id}:retry`,
      amount: 10,
    });
    const second = await characters.service.grantExperience({
      characterId: hero.id,
      operationId: `test:${hero.id}:retry`,
      amount: 10,
    });
    expect(second).toEqual(first);
    const stored = await characters.service.getByAccountId(hero.accountId);
    expect(stored?.exp).toBe(11);
    await expect(
      characters.service.grantExperience({
        characterId: hero.id,
        operationId: `test:${hero.id}:retry`,
        amount: 11,
      }),
    ).rejects.toBeInstanceOf(ExperienceGrantConflictError);
  });

  it("applies a concurrent duplicate once and rolls back a failed unit of work", async () => {
    const hero = await createHero();
    const operationId = `test:${hero.id}:concurrent`;
    const firstClient = new PostgresDatabase(databaseUrl);
    const secondClient = new PostgresDatabase(databaseUrl);
    try {
      const left = await modulesFor(firstClient);
      const right = await modulesFor(secondClient);
      const [first, second] = await Promise.all([
        left.characters.service.grantExperience({ characterId: hero.id, operationId, amount: 10 }),
        right.characters.service.grantExperience({ characterId: hero.id, operationId, amount: 10 }),
      ]);
      expect(first).toEqual(second);
    } finally {
      await Promise.all([firstClient.close(), secondClient.close()]);
    }
    expect((await characters.service.getByAccountId(hero.accountId))?.exp).toBe(11);

    const rolling = await createHero();
    await expect(
      database.run(async () => {
        await characters.service.grantExperience({
          characterId: rolling.id,
          operationId: `test:${rolling.id}:rollback`,
          amount: 10,
        });
        throw new Error("injected failure");
      }),
    ).rejects.toThrow("injected failure");
    expect((await characters.service.getByAccountId(rolling.accountId))?.exp).toBe(1);
  });

  it("rejects missing heroes, overflow and out-of-curve grants without mutation", async () => {
    await expect(
      characters.service.grantExperience({
        characterId: 2_147_483_647,
        operationId: "test:missing:1",
        amount: 1,
      }),
    ).rejects.toBeInstanceOf(CharacterNotFoundError);
    const hero = await createHero();
    await expect(
      characters.service.grantExperience({
        characterId: hero.id,
        operationId: `test:${hero.id}:overflow`,
        amount: 2_147_483_647,
      }),
    ).rejects.toBeInstanceOf(InvalidExperienceGrantError);
    await expect(
      characters.service.grantExperience({
        characterId: hero.id,
        operationId: `test:${hero.id}:limit`,
        amount: 23872,
      }),
    ).rejects.toBeInstanceOf(ProgressionLimitError);
    expect((await characters.service.getByAccountId(hero.accountId))?.exp).toBe(1);
  });

  async function createHero() {
    const slot = uniqueDevelopmentSlot();
    const account = await identity.service.register(`u${slot}`, `N${slot}`, "secret1");
    const hero = await characters.service.getOrCreateForAccount(
      account.account.id,
      account.account.nick,
    );
    await inventory.service.ensureStarterInventory(hero.id);
    return hero;
  }
});

async function modulesFor(database: PostgresDatabase) {
  const catalog = await CatalogModule.create({ database });
  const inventory = InventoryModule.create({
    database,
    starterItems: policy.starterItems,
    releaseArtifacts: catalog.releaseArtifacts,
    catalog: catalog.catalog,
    bagCapacity: policy.bootstrap.bagCapacity,
  });
  const characters = CharacterModule.create(
    playableCharacterModuleInput(database, catalog.progression, inventory.service, {
      creationPolicy: policy.heroCreation,
    }),
  );
  return { catalog, inventory, characters };
}
