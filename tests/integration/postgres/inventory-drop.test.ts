import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadGamePolicy } from "../../../src/app/game-policy.ts";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { publishDevelopmentContent } from "../../../src/infrastructure/postgres/publish-development-content.ts";
import { CatalogModule } from "../../../src/modules/catalog/catalog-module.ts";
import { CharacterModule } from "../../../src/modules/character/character-module.ts";
import { IdentityModule } from "../../../src/modules/identity/identity-module.ts";
import { DropDeniedError } from "../../../src/modules/inventory/domain/drop-denied-error.ts";
import { InventoryModule } from "../../../src/modules/inventory/inventory-module.ts";
import { uniqueDevelopmentSlot } from "../../support/harness/unique-development-slot.ts";
import { playableCharacterModuleInput } from "../../support/playable-character-module-input.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";
import { SystemClock } from "../../../src/shared/kernel/system-clock.ts";

const databaseUrl = requireTestDatabaseUrl();
const policy = loadGamePolicy(path.resolve(process.cwd(), "config/development.json"));

describe("inventory drop persistence", () => {
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

  it("serializes concurrent DROP so one delete wins", async () => {
    const hero = await createHero();
    const [glove] = (await inventory.service.list(hero.id)).filter(
      (item) => item.artifactId === 9095,
    );
    if (!glove) throw new Error("starter glove is missing");
    const results = await Promise.allSettled([
      database.run(async () => inventory.service.drop({ characterId: hero.id, itemId: glove.id })),
      database.run(async () => inventory.service.drop({ characterId: hero.id, itemId: glove.id })),
    ]);
    const accepted = results.filter((result) => result.status === "fulfilled");
    const denied = results.filter(
      (result) => result.status === "rejected" && result.reason instanceof DropDeniedError,
    );
    expect(accepted).toHaveLength(1);
    expect(denied).toHaveLength(1);
    const remaining = await inventory.service.list(hero.id);
    expect(remaining).toHaveLength(3);
    expect(remaining.some((item) => item.artifactId === 9095)).toBe(false);
  });

  it("rolls back DROP in a failed unit of work", async () => {
    const hero = await createHero();
    const [item] = await inventory.service.list(hero.id);
    if (!item) throw new Error("starter item is missing");
    await expect(
      database.run(async () => {
        await inventory.service.drop({ characterId: hero.id, itemId: item.id });
        throw new Error("forced rollback");
      }),
    ).rejects.toThrow(/forced rollback/);
    const remaining = await inventory.service.list(hero.id);
    expect(remaining).toHaveLength(4);
    expect(remaining[0]?.id).toBe(item.id);
  });

  it("fails credit overflow without clamping", async () => {
    const hero = await createHero();
    await characters.service.creditMoney({
      characterId: hero.id,
      minorUnits: 2_147_481_147,
    });
    await expect(
      characters.service.creditMoney({ characterId: hero.id, minorUnits: 1 }),
    ).rejects.toThrow(/overflow/);
    const stored = await characters.service.getByAccountId(hero.accountId);
    expect(stored?.moneyMinor).toBe(2_147_483_647);
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
