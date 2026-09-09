import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadGamePolicy } from "../../../src/app/game-policy.ts";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { publishDevelopmentContent } from "../../../src/infrastructure/postgres/publish-development-content.ts";
import { CatalogModule } from "../../../src/modules/catalog/catalog-module.ts";
import { CharacterModule } from "../../../src/modules/character/character-module.ts";
import { IdentityModule } from "../../../src/modules/identity/identity-module.ts";
import type { InventoryItem } from "../../../src/modules/inventory/domain/inventory-item.ts";
import { WearDeniedError } from "../../../src/modules/inventory/domain/wear-denied-error.ts";
import { InventoryModule } from "../../../src/modules/inventory/inventory-module.ts";
import { uniqueDevelopmentSlot } from "../../support/harness/unique-development-slot.ts";
import { playableCharacterModuleInput } from "../../support/playable-character-module-input.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";
import { SystemClock } from "../../../src/shared/kernel/system-clock.ts";

const databaseUrl = requireTestDatabaseUrl();
const policy = loadGamePolicy(path.resolve(process.cwd(), "config/development.json"));
const RECRUIT_5 = [30, 35, 33, 27, 28] as const;

describe("inventory set-bonus persistence", () => {
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

  it("persists TEMPEFFECT 106 and keeps a single row under concurrent PUT_ON", async () => {
    const created = await createHero();
    await characters.service.grantExperience({
      characterId: created.id,
      operationId: `test:${created.id}:set-l12`,
      amount: 122_872,
    });
    const hero = await requireHero(created.accountId);
    for (const artifactId of RECRUIT_5) {
      await database.run(async () =>
        inventory.service.grantToBag({ characterId: hero.id, artifactId, quantity: 1 }),
      );
    }
    await database.run(async () => {
      for (const artifactId of RECRUIT_5.slice(0, 4)) {
        const item = requireArtikul(await inventory.service.list(hero.id), artifactId);
        const definition = await catalog.catalog.artifact(artifactId);
        if (!definition) throw new Error(`Artifact catalog entry ${artifactId} is missing`);
        await inventory.service.putOn(hero, item.id, definition);
      }
    });
    const helm = requireArtikul(await inventory.service.list(hero.id), 28);
    const definition = await catalog.catalog.artifact(28);
    if (!definition) throw new Error("Artifact catalog entry 28 is missing");
    const results = await Promise.allSettled([
      database.run(async () => inventory.service.putOn(hero, helm.id, definition)),
      database.run(async () => inventory.service.putOn(hero, helm.id, definition)),
    ]);
    const worn = results.filter((result) => result.status === "fulfilled");
    const denied = results.filter(
      (result) => result.status === "rejected" && result.reason instanceof WearDeniedError,
    );
    expect(worn).toHaveLength(1);
    expect(denied).toHaveLength(1);
    const bonuses = (await inventory.service.list(hero.id)).filter(
      (item) => item.artifactId === 106,
    );
    expect(bonuses).toHaveLength(1);
    expect(bonuses[0]?.location).toEqual({ kind: "tempeffect" });
    expect(bonuses[0]?.quantity).toBe(0);
    const spells = await inventory.service.equippedGearSpells(hero.id);
    expect(spells).toEqual([]);
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

  async function requireHero(accountId: number) {
    const hero = await characters.service.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }
});

function requireArtikul(items: readonly InventoryItem[], artifactId: number): InventoryItem {
  const matches = items.filter((item) => item.artifactId === artifactId);
  if (matches.length !== 1) throw new Error(`expected one item ${artifactId}`);
  const item = matches[0];
  if (!item) throw new Error(`expected one item ${artifactId}`);
  return item;
}
