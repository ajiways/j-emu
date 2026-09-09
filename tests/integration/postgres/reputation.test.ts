import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadGamePolicy } from "../../../src/app/game-policy.ts";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { publishDevelopmentContent } from "../../../src/infrastructure/postgres/publish-development-content.ts";
import { CatalogModule } from "../../../src/modules/catalog/catalog-module.ts";
import { CharacterModule } from "../../../src/modules/character/character-module.ts";
import { SumReputationGrantError } from "../../../src/modules/character/domain/sum-reputation-grant-error.ts";
import { UnknownReputationTrackError } from "../../../src/modules/character/domain/unknown-reputation-track-error.ts";
import { IdentityModule } from "../../../src/modules/identity/identity-module.ts";
import { InventoryModule } from "../../../src/modules/inventory/inventory-module.ts";
import { uniqueDevelopmentSlot } from "../../support/harness/unique-development-slot.ts";
import { playableCharacterModuleInput } from "../../support/playable-character-module-input.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";
import { SystemClock } from "../../../src/shared/kernel/system-clock.ts";

const databaseUrl = requireTestDatabaseUrl();
const policy = loadGamePolicy(path.resolve(process.cwd(), "config/development.json"));

describe("hero reputation", () => {
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
    ({ database, identity, catalog, inventory, characters } = await openModules(databaseUrl));
  });

  afterAll(async () => {
    await closeModules({ identity, characters, inventory, catalog, database });
  });

  it("projects published track 5", async () => {
    const tracks = await catalog.catalog.reputationTracks();
    expect(tracks).toEqual([
      {
        objectId: 5,
        type: 2,
        title: "Репутация Радвея",
        image: "rep_radvey_sm.png",
        unlockFlag: "",
      },
    ]);
    await expect(catalog.catalog.reputationTrack(5)).resolves.toMatchObject({ objectId: 5 });
    await expect(catalog.catalog.reputationTrack(36)).resolves.toBeNull();
  });

  it("persists a grant through reconnect", async () => {
    const hero = await createHero();
    const granted = await characters.service.grantReputation({
      characterId: hero.id,
      objectId: 5,
      amount: 10,
      cap: 0,
    });
    expect(granted).toEqual({ objectId: 5, value: 10, total: 10 });
    await closeModules({ identity, characters, inventory, catalog, database });
    ({ database, identity, catalog, inventory, characters } = await openModules(databaseUrl));
    await expect(characters.service.reputations(hero.id)).resolves.toEqual([
      { objectId: 5, value: 10 },
    ]);
  });

  it("serializes concurrent grants on the same hero", async () => {
    const hero = await createHero();
    await Promise.all([
      characters.service.grantReputation({
        characterId: hero.id,
        objectId: 5,
        amount: 10,
        cap: 0,
      }),
      characters.service.grantReputation({
        characterId: hero.id,
        objectId: 5,
        amount: 10,
        cap: 0,
      }),
    ]);
    await expect(characters.service.reputations(hero.id)).resolves.toEqual([
      { objectId: 5, value: 20 },
    ]);
  });

  it("rejects SUM 36 and an unpublished track", async () => {
    const hero = await createHero();
    await expect(
      characters.service.grantReputation({
        characterId: hero.id,
        objectId: 36,
        amount: 10,
        cap: 0,
      }),
    ).rejects.toBeInstanceOf(SumReputationGrantError);
    await expect(
      characters.service.grantReputation({
        characterId: hero.id,
        objectId: 7,
        amount: 10,
        cap: 0,
      }),
    ).rejects.toBeInstanceOf(UnknownReputationTrackError);
    await expect(characters.service.reputations(hero.id)).resolves.toEqual([]);
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

async function openModules(url: string) {
  const database = new PostgresDatabase(url);
  const identity = IdentityModule.create({ database, clock: new SystemClock() });
  const catalog = await CatalogModule.create({ database });
  const inventory = InventoryModule.create({
    database,
    starterItems: policy.starterItems,
    releaseArtifacts: catalog.releaseArtifacts,
    catalog: catalog.catalog,
    bagCapacity: policy.bootstrap.bagCapacity,
    pocketCapacity: policy.bootstrap.pocketCapacity,
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
  return { database, identity, catalog, inventory, characters };
}

async function closeModules(modules: {
  identity: IdentityModule;
  characters: CharacterModule;
  inventory: InventoryModule;
  catalog: CatalogModule;
  database: PostgresDatabase;
}): Promise<void> {
  await modules.identity.close();
  await modules.characters.close();
  await modules.inventory.close();
  await modules.catalog.close();
  await modules.database.close();
}
