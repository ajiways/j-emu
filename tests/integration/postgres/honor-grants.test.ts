import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadGamePolicy } from "../../../src/app/game-policy.ts";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { publishDevelopmentContent } from "../../../src/infrastructure/postgres/publish-development-content.ts";
import { CatalogModule } from "../../../src/modules/catalog/catalog-module.ts";
import { CharacterModule } from "../../../src/modules/character/character-module.ts";
import { CharacterNotFoundError } from "../../../src/modules/character/domain/character-not-found-error.ts";
import { HonorGrantConflictError } from "../../../src/modules/character/domain/honor-grant-conflict-error.ts";
import { InvalidHonorGrantError } from "../../../src/modules/character/domain/invalid-honor-grant-error.ts";
import { IdentityModule } from "../../../src/modules/identity/identity-module.ts";
import { InventoryModule } from "../../../src/modules/inventory/inventory-module.ts";
import { uniqueDevelopmentSlot } from "../../support/harness/unique-development-slot.ts";
import { playableCharacterModuleInput } from "../../support/playable-character-module-input.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";
import { SystemClock } from "../../../src/shared/kernel/system-clock.ts";

const databaseUrl = requireTestDatabaseUrl();
const policy = loadGamePolicy(path.resolve(process.cwd(), "config/development.json"));
const LEVEL6_EXP = 1822;

describe("honor grants", () => {
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
      pocketCapacity: policy.bootstrap.pocketCapacity,
      random: { unit: () => 0 },
    });
    characters = CharacterModule.create(
      playableCharacterModuleInput(
        database,
        catalog.progression,
        inventory.service,
        catalog.catalog,
        {
          creationPolicy: policy.heroCreation,
        },
      ),
    );
  });

  afterAll(async () => {
    await identity.close();
    await characters.close();
    await inventory.close();
    await catalog.close();
    await database.close();
  });

  it("persists honor, replays the same operationId, and rejects a conflicting amount", async () => {
    const hero = await createHero();
    const first = await characters.service.grantHonor({
      characterId: hero.id,
      operationId: `pvp:${hero.id}:1`,
      amount: 50,
    });
    expect(first).toMatchObject({
      honorBefore: 0,
      honorAfter: 50,
      added: 50,
      rank: 0,
      honorMin: 0,
      honorMax: 100,
      honorStatus: 0,
    });
    const second = await characters.service.grantHonor({
      characterId: hero.id,
      operationId: `pvp:${hero.id}:1`,
      amount: 50,
    });
    expect(second).toEqual(first);
    expect((await characters.service.getByAccountId(hero.accountId))?.honor).toBe(50);
    await expect(
      characters.service.grantHonor({
        characterId: hero.id,
        operationId: `pvp:${hero.id}:1`,
        amount: 51,
      }),
    ).rejects.toBeInstanceOf(HonorGrantConflictError);
  });

  it("clamps at the Силач cap for L6 and can persist added 0", async () => {
    const hero = await createHero();
    await characters.service.grantExperience({
      characterId: hero.id,
      operationId: `test:${hero.id}:l6`,
      amount: LEVEL6_EXP,
    });
    const clamped = await characters.service.grantHonor({
      characterId: hero.id,
      operationId: `pvp:${hero.id}:cap`,
      amount: 3000,
    });
    expect(clamped).toMatchObject({
      honorBefore: 0,
      honorAfter: 2500,
      added: 2500,
      rank: 3,
      honorMin: 2500,
      honorMax: 2500,
      honorStatus: 1,
    });
    const atCap = await characters.service.grantHonor({
      characterId: hero.id,
      operationId: `pvp:${hero.id}:zero`,
      amount: 10,
    });
    expect(atCap).toMatchObject({ honorBefore: 2500, honorAfter: 2500, added: 0 });
    expect((await characters.service.getByAccountId(hero.accountId))?.honor).toBe(2500);
  });

  it("applies a concurrent duplicate once and rolls back a failed unit of work", async () => {
    const hero = await createHero();
    const operationId = `pvp:${hero.id}:concurrent`;
    const firstClient = new PostgresDatabase(databaseUrl);
    const secondClient = new PostgresDatabase(databaseUrl);
    try {
      const left = await modulesFor(firstClient);
      const right = await modulesFor(secondClient);
      const [first, second] = await Promise.all([
        left.characters.service.grantHonor({ characterId: hero.id, operationId, amount: 10 }),
        right.characters.service.grantHonor({ characterId: hero.id, operationId, amount: 10 }),
      ]);
      expect(first).toEqual(second);
    } finally {
      await Promise.all([firstClient.close(), secondClient.close()]);
    }
    expect((await characters.service.getByAccountId(hero.accountId))?.honor).toBe(10);

    const rolling = await createHero();
    await expect(
      database.run(async () => {
        await characters.service.grantHonor({
          characterId: rolling.id,
          operationId: `pvp:${rolling.id}:rollback`,
          amount: 10,
        });
        throw new Error("injected failure");
      }),
    ).rejects.toThrow("injected failure");
    expect((await characters.service.getByAccountId(rolling.accountId))?.honor).toBe(0);
  });

  it("rejects missing heroes and overflow without mutation", async () => {
    await expect(
      characters.service.grantHonor({
        characterId: 2_147_483_647,
        operationId: "pvp:missing:1",
        amount: 1,
      }),
    ).rejects.toBeInstanceOf(CharacterNotFoundError);
    const hero = await createHero();
    await characters.service.grantHonor({
      characterId: hero.id,
      operationId: `pvp:${hero.id}:seed`,
      amount: 1,
    });
    await expect(
      characters.service.grantHonor({
        characterId: hero.id,
        operationId: `pvp:${hero.id}:overflow`,
        amount: 2_147_483_647,
      }),
    ).rejects.toBeInstanceOf(InvalidHonorGrantError);
    expect((await characters.service.getByAccountId(hero.accountId))?.honor).toBe(1);
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
    pocketCapacity: policy.bootstrap.pocketCapacity,
    random: { unit: () => 0 },
  });
  const characters = CharacterModule.create(
    playableCharacterModuleInput(
      database,
      catalog.progression,
      inventory.service,
      catalog.catalog,
      {
        creationPolicy: policy.heroCreation,
      },
    ),
  );
  return { catalog, inventory, characters };
}
