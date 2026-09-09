import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadGamePolicy } from "../../../src/app/game-policy.ts";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { publishDevelopmentContent } from "../../../src/infrastructure/postgres/publish-development-content.ts";
import { CatalogModule } from "../../../src/modules/catalog/catalog-module.ts";
import { CharacterModule } from "../../../src/modules/character/character-module.ts";
import { IdentityModule } from "../../../src/modules/identity/identity-module.ts";
import type { InventoryItem } from "../../../src/modules/inventory/domain/inventory-item.ts";
import { UpgradeDeniedError } from "../../../src/modules/inventory/domain/upgrade-denied-error.ts";
import { UPGRADE_FAIL_ERROR } from "../../../src/modules/inventory/domain/upgrade-tables.ts";
import { InventoryModule } from "../../../src/modules/inventory/inventory-module.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { uniqueDevelopmentSlot } from "../../support/harness/unique-development-slot.ts";
import { playableCharacterModuleInput } from "../../support/playable-character-module-input.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";
import { SystemClock } from "../../../src/shared/kernel/system-clock.ts";

const databaseUrl = requireTestDatabaseUrl();
const policy = loadGamePolicy(path.resolve(process.cwd(), "config/development.json"));

describe("inventory upgrade persistence", () => {
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

  it("persists overlay on the same instance id", async () => {
    const hero = await createHero();
    const chest = requireArtikul(await inventory.service.list(hero.id), 20);
    const crystal = requireArtikul(await inventory.service.list(hero.id), 4603);
    const result = await database.run(async () =>
      inventory.service.applyGearUpgrade({
        characterId: hero.id,
        crystalItemId: crystal.id,
        targetItemId: chest.id,
      }),
    );
    expect(result).toEqual({ ok: true });
    const after = requireArtikul(await inventory.service.list(hero.id), 20);
    expect(after.id).toBe(chest.id);
    expect(after.upgrade).toMatchObject({ id: 3, level: 1, skillId: "DEF", bound: false });
    expect(requireArtikul(await inventory.service.list(hero.id), 4603).quantity).toBe(5);
  });

  it("commits crystal consume when the roll fails", async () => {
    const failing = InventoryModule.create({
      database,
      starterItems: policy.starterItems,
      releaseArtifacts: catalog.releaseArtifacts,
      catalog: catalog.catalog,
      bagCapacity: policy.bootstrap.bagCapacity,
      pocketCapacity: policy.bootstrap.pocketCapacity,
      random: new SequenceRandom([0.95]),
    });
    const hero = await createHero();
    const chest = requireArtikul(await failing.service.list(hero.id), 20);
    const crystal = requireArtikul(await failing.service.list(hero.id), 1310);
    const result = await database.run(async () =>
      failing.service.applyGearUpgrade({
        characterId: hero.id,
        crystalItemId: crystal.id,
        targetItemId: chest.id,
      }),
    );
    expect(result).toEqual({ ok: false, error: UPGRADE_FAIL_ERROR });
    expect(requireArtikul(await failing.service.list(hero.id), 20).upgrade.level).toBe(0);
    expect(
      (await failing.service.list(hero.id)).filter((item) => item.artifactId === 1310),
    ).toEqual([]);
    await failing.close();
  });

  it("lets one concurrent upgrade win the last ordinary crystal", async () => {
    const hero = await createHero();
    const chest = requireArtikul(await inventory.service.list(hero.id), 20);
    const crystal = requireArtikul(await inventory.service.list(hero.id), 1310);
    const results = await Promise.allSettled([
      database.run(async () =>
        inventory.service.applyGearUpgrade({
          characterId: hero.id,
          crystalItemId: crystal.id,
          targetItemId: chest.id,
        }),
      ),
      database.run(async () =>
        inventory.service.applyGearUpgrade({
          characterId: hero.id,
          crystalItemId: crystal.id,
          targetItemId: chest.id,
        }),
      ),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const denied = results.filter(
      (result) => result.status === "rejected" && result.reason instanceof UpgradeDeniedError,
    );
    expect(fulfilled).toHaveLength(1);
    expect(denied).toHaveLength(1);
    expect(
      (await inventory.service.list(hero.id)).filter((item) => item.artifactId === 1310),
    ).toEqual([]);
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

function requireArtikul(items: readonly InventoryItem[], artifactId: number): InventoryItem {
  const matches = items.filter((item) => item.artifactId === artifactId);
  if (matches.length !== 1) throw new Error(`expected one item ${artifactId}`);
  return matches[0]!;
}
