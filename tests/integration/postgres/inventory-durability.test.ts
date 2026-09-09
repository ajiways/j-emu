import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadGamePolicy } from "../../../src/app/game-policy.ts";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { publishDevelopmentContent } from "../../../src/infrastructure/postgres/publish-development-content.ts";
import { CatalogModule } from "../../../src/modules/catalog/catalog-module.ts";
import { CharacterModule } from "../../../src/modules/character/character-module.ts";
import { IdentityModule } from "../../../src/modules/identity/identity-module.ts";
import { BrokenItemError } from "../../../src/modules/inventory/domain/broken-item-error.ts";
import type { InventoryItem } from "../../../src/modules/inventory/domain/inventory-item.ts";
import { RepairDeniedError } from "../../../src/modules/inventory/domain/repair-denied-error.ts";
import { PostgresInventoryRepository } from "../../../src/modules/inventory/infrastructure/postgres-inventory-repository.ts";
import { InventoryModule } from "../../../src/modules/inventory/inventory-module.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { uniqueDevelopmentSlot } from "../../support/harness/unique-development-slot.ts";
import { playableCharacterModuleInput } from "../../support/playable-character-module-input.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";
import { SystemClock } from "../../../src/shared/kernel/system-clock.ts";

const databaseUrl = requireTestDatabaseUrl();
const policy = loadGamePolicy(path.resolve(process.cwd(), "config/development.json"));

describe("inventory durability persistence", () => {
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

  it("persists a death break and repair to (max-1)/(max-1)", async () => {
    const hero = await createHero();
    const glove = requireArtikul(await inventory.service.list(hero.id), 9095);
    const definition = await requireDefinition(9095);
    await database.run(async () => inventory.service.putOn(hero, glove.id, definition));
    await database.run(async () =>
      inventory.service.applyDeathDurability({
        characterId: hero.id,
        random: new SequenceRandom([0, 0, 0, 0, 0, 0, 0, 0]),
      }),
    );
    const afterDeath = requireArtikul(await inventory.service.list(hero.id), 9095);
    expect(afterDeath).toMatchObject({ durability: 2, durabilityMax: 3 });
    expect(afterDeath.location).toEqual({ kind: "equipment", slot: 32 });
    await database.run(async () =>
      inventory.service.repair({ characterId: hero.id, itemId: afterDeath.id }),
    );
    expect(requireArtikul(await inventory.service.list(hero.id), 9095)).toMatchObject({
      durability: 2,
      durabilityMax: 2,
    });
  });

  it("rejects PUT_ON of a 0/N instance and serializes concurrent repair", async () => {
    const hero = await createHero();
    const chest = requireArtikul(await inventory.service.list(hero.id), 20);
    const definition = await requireDefinition(20);
    const repository = new PostgresInventoryRepository(database);
    await repository.save(chest.withDurability(0, 30));
    await expect(
      database.run(async () => inventory.service.putOn(hero, chest.id, definition)),
    ).rejects.toBeInstanceOf(BrokenItemError);

    const results = await Promise.allSettled([
      database.run(async () =>
        inventory.service.repair({ characterId: hero.id, itemId: chest.id }),
      ),
      database.run(async () =>
        inventory.service.repair({ characterId: hero.id, itemId: chest.id }),
      ),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const denied = results.filter(
      (result) => result.status === "rejected" && result.reason instanceof RepairDeniedError,
    );
    expect(fulfilled).toHaveLength(1);
    expect(denied).toHaveLength(1);
    expect(requireArtikul(await inventory.service.list(hero.id), 20)).toMatchObject({
      durability: 29,
      durabilityMax: 29,
    });
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

  async function requireDefinition(id: number) {
    const definition = await catalog.catalog.artifact(id);
    if (!definition) throw new Error(`artifact ${id} is missing`);
    return definition;
  }

  function requireArtikul(items: readonly InventoryItem[], artifactId: number): InventoryItem {
    const item = items.find((row) => row.artifactId === artifactId);
    if (!item) throw new Error(`artikul ${artifactId} is missing`);
    return item;
  }
});
