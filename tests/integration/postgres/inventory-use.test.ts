import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadGamePolicy } from "../../../src/app/game-policy.ts";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { publishDevelopmentContent } from "../../../src/infrastructure/postgres/publish-development-content.ts";
import { CatalogModule } from "../../../src/modules/catalog/catalog-module.ts";
import { CharacterModule } from "../../../src/modules/character/character-module.ts";
import { IdentityModule } from "../../../src/modules/identity/identity-module.ts";
import { InventoryModule } from "../../../src/modules/inventory/inventory-module.ts";
import { UseDeniedError } from "../../../src/modules/inventory/domain/use-denied-error.ts";
import { uniqueDevelopmentSlot } from "../../support/harness/unique-development-slot.ts";
import { playableCharacterModuleInput } from "../../support/playable-character-module-input.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";
import { SystemClock } from "../../../src/shared/kernel/system-clock.ts";

const databaseUrl = requireTestDatabaseUrl();
const policy = loadGamePolicy(path.resolve(process.cwd(), "config/development.json"));

describe("inventory USE persistence", () => {
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

  it("deletes the row when the last meat charge is consumed", async () => {
    const hero = await createHero();
    const meat = requireArtikul(await inventory.service.list(hero.id), 77);
    await database.run(async () =>
      inventory.service.drop({ characterId: hero.id, itemId: meat.id, amount: 3 }),
    );
    const last = requireArtikul(await inventory.service.list(hero.id), 77);
    expect(last.quantity).toBe(1);
    await database.run(async () =>
      inventory.service.useFromBag({
        characterId: hero.id,
        itemId: last.id,
        hpMax: hero.maxHp,
      }),
    );
    expect(
      (await inventory.service.list(hero.id)).filter((item) => item.artifactId === 77),
    ).toEqual([]);
  });

  it("lets only one concurrent USE consume the last charge", async () => {
    const hero = await createHero();
    const meat = requireArtikul(await inventory.service.list(hero.id), 77);
    await database.run(async () =>
      inventory.service.drop({ characterId: hero.id, itemId: meat.id, amount: 3 }),
    );
    const last = requireArtikul(await inventory.service.list(hero.id), 77);
    const results = await Promise.allSettled([
      database.run(async () =>
        inventory.service.useFromBag({
          characterId: hero.id,
          itemId: last.id,
          hpMax: hero.maxHp,
        }),
      ),
      database.run(async () =>
        inventory.service.useFromBag({
          characterId: hero.id,
          itemId: last.id,
          hpMax: hero.maxHp,
        }),
      ),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ status: "rejected" });
    if (rejected[0]?.status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(UseDeniedError);
    }
    expect(
      (await inventory.service.list(hero.id)).filter((item) => item.artifactId === 77),
    ).toEqual([]);
  });

  it("rolls back HP and remaining cnt when the unit of work fails", async () => {
    const hero = await createHero();
    await database.run(async () => characters.service.noteHp({ characterId: hero.id, hp: 1 }));
    const wounded = await characters.service.lockByAccountId(hero.accountId);
    expect(wounded.hp).toBe(1);
    const meat = requireArtikul(await inventory.service.list(hero.id), 77);
    await expect(
      database.run(async () => {
        const used = await inventory.service.useFromBag({
          characterId: hero.id,
          itemId: meat.id,
          hpMax: hero.maxHp,
        });
        await characters.service.noteHp({
          characterId: hero.id,
          hp: Math.min(hero.maxHp, 1 + used.gain),
        });
        throw new Error("forced rollback");
      }),
    ).rejects.toThrow(/forced rollback/);
    const after = await characters.service.lockByAccountId(hero.accountId);
    expect(after.hp).toBe(1);
    expect(requireArtikul(await inventory.service.list(hero.id), 77).quantity).toBe(4);
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

function requireArtikul(
  items: readonly { id: number; artifactId: number; quantity: number }[],
  artifactId: number,
) {
  const matches = items.filter((item) => item.artifactId === artifactId);
  if (matches.length !== 1) throw new Error(`expected one item ${artifactId}`);
  const item = matches[0];
  if (!item) throw new Error(`item ${artifactId} is missing`);
  return item;
}
