import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadGamePolicy } from "../../../src/app/game-policy.ts";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { publishDevelopmentContent } from "../../../src/infrastructure/postgres/publish-development-content.ts";
import { CatalogModule } from "../../../src/modules/catalog/catalog-module.ts";
import { CharacterModule } from "../../../src/modules/character/character-module.ts";
import type { FightCounterDelta } from "../../../src/modules/character/ports/hero-lifetime-stats.ts";
import { IdentityModule } from "../../../src/modules/identity/identity-module.ts";
import { InventoryModule } from "../../../src/modules/inventory/inventory-module.ts";
import { uniqueDevelopmentSlot } from "../../support/harness/unique-development-slot.ts";
import { playableCharacterModuleInput } from "../../support/playable-character-module-input.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";
import { SystemClock } from "../../../src/shared/kernel/system-clock.ts";

const databaseUrl = requireTestDatabaseUrl();
const policy = loadGamePolicy(path.resolve(process.cwd(), "config/development.json"));

describe("hero lifetime stats", () => {
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

  const delta = (
    characterId: number,
    over: Partial<FightCounterDelta> = {},
  ): FightCounterDelta => ({
    characterId,
    wins: 0,
    losses: 0,
    duelWins: 0,
    fightDamage: 0,
    fatalities: 0,
    pvpKills: 0,
    dailyCycleStart: 1000,
    ...over,
  });

  it("starts at zero and adds every fight, keeping the largest damage of one fight", async () => {
    const hero = await createHero();
    const stats = characters.service;
    expect(await stats.read(hero.id, 1000)).toEqual({
      wins: 0,
      losses: 0,
      duelWins: 0,
      maxFightDamage: 0,
      fatalities: 0,
      pvpKills: 0,
      dailyPvpKills: 0,
    });
    await stats.applyFight(
      delta(hero.id, { wins: 1, fightDamage: 40, fatalities: 1, pvpKills: 2 }),
    );
    await stats.applyFight(delta(hero.id, { losses: 1, fightDamage: 25, duelWins: 1 }));
    expect(await stats.read(hero.id, 1000)).toEqual({
      wins: 1,
      losses: 1,
      duelWins: 1,
      maxFightDamage: 40,
      fatalities: 1,
      pvpKills: 2,
      dailyPvpKills: 2,
    });
  });

  it("starts the daily kills again in a later cycle and shows none in an earlier read", async () => {
    const hero = await createHero();
    const stats = characters.service;
    await stats.applyFight(delta(hero.id, { pvpKills: 3, dailyCycleStart: 1000 }));
    // The next day's read has no kills yet, the total stays.
    expect(await stats.read(hero.id, 1000 + 86_400)).toMatchObject({
      pvpKills: 3,
      dailyPvpKills: 0,
    });
    await stats.applyFight(delta(hero.id, { pvpKills: 1, dailyCycleStart: 1000 + 86_400 }));
    expect(await stats.read(hero.id, 1000 + 86_400)).toMatchObject({
      pvpKills: 4,
      dailyPvpKills: 1,
    });
  });

  it("refuses a delta that is not a non-negative integer", async () => {
    const hero = await createHero();
    await expect(characters.service.applyFight(delta(hero.id, { wins: -1 }))).rejects.toThrow(
      /non-negative integer/,
    );
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
