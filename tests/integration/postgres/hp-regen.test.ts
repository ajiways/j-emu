import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AccountKeyedActiveFightQuery } from "../../../src/app/account-keyed-active-fight-query.ts";
import { loadGamePolicy } from "../../../src/app/game-policy.ts";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { PostgresHeroRepository } from "../../../src/modules/character/infrastructure/postgres-hero-repository.ts";
import { publishDevelopmentContent } from "../../../src/infrastructure/postgres/publish-development-content.ts";
import { CatalogModule } from "../../../src/modules/catalog/catalog-module.ts";
import { CharacterModule } from "../../../src/modules/character/character-module.ts";
import { CombatModule } from "../../../src/modules/combat/combat-module.ts";
import { SystemCombatDelay } from "../../../src/modules/combat/infrastructure/system-combat-delay.ts";
import { IdentityModule } from "../../../src/modules/identity/identity-module.ts";
import { InventoryModule } from "../../../src/modules/inventory/inventory-module.ts";
import { uniqueDevelopmentSlot } from "../../support/harness/unique-development-slot.ts";
import { FakeClock } from "../../support/fake-clock.ts";
import { PLAYABLE_REGEN_POLICY } from "../../support/hero-fixtures.ts";
import { playableCharacterModuleInput } from "../../support/playable-character-module-input.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { EMPTY_HUNT_BOT_SPELL_BOOK, GRYZL_FIGHT_LOOK } from "../../support/hunt-start-input.ts";

const databaseUrl = requireTestDatabaseUrl();
const policy = loadGamePolicy(path.resolve(process.cwd(), "config/development.json"));
const START_MS = 1_700_000_000_000;

describe("HP regeneration persistence", () => {
  let database: PostgresDatabase;
  let identity: IdentityModule;
  let catalog: CatalogModule;
  let inventory: InventoryModule;
  let combat: CombatModule;
  let characters: CharacterModule;
  let clock: FakeClock;

  beforeAll(async () => {
    await publishDevelopmentContent(
      databaseUrl,
      path.resolve(process.cwd(), "content/playable-slice.json"),
    );
    database = new PostgresDatabase(databaseUrl);
    clock = new FakeClock(START_MS);
    identity = IdentityModule.create({ database, clock });
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
    combat = CombatModule.create({
      database,
      rules: {
        strPerDamagePoint: policy.combat.strPerDamagePoint,
        damageSpread: policy.combat.damageSpread,
        turnTimeoutSeconds: policy.combat.turnTimeoutSeconds,
        meleeBotCounterMs: policy.combat.meleeBotCounterMs,
        turnGrantDelayMs: policy.combat.turnGrantDelayMs,
      },
      clock,
      delay: new SystemCombatDelay(),
    });
    characters = CharacterModule.create(
      playableCharacterModuleInput(
        database,
        catalog.progression,
        inventory.service,
        catalog.catalog,
        {
          creationPolicy: policy.heroCreation,
          clock,
          regenPolicy: PLAYABLE_REGEN_POLICY,
          activeFight: new AccountKeyedActiveFightQuery(
            new PostgresHeroRepository(database),
            combat.combat,
          ),
        },
      ),
    );
  });

  afterAll(async () => {
    await combat.close();
    await identity.close();
    await characters.close();
    await inventory.close();
    await catalog.close();
    await database.close();
  });

  it("persists unix-second truncated regen_at on creation", async () => {
    const hero = await createHero();
    expect(hero.hpTime).toBe(0);
    expect(hero.hp).toBe(hero.maxHp);
    expect(hero.regenAt.getTime() % 1000).toBe(0);
    expect(hero.regenAt.getTime()).toBe(clock.unixSeconds() * 1000);
    const stored = await characters.service.getByAccountId(hero.accountId);
    expect(stored?.regenAt.getTime()).toBe(START_MS);
  });

  it("applies elapsed regen across a process-local clock advance", async () => {
    const hero = await createHero();
    await characters.service.noteHp({ characterId: hero.id, hp: 1 });
    clock.advanceSeconds(1);
    const synced = await characters.service.syncResources({ characterId: hero.id });
    expect(synced.hp).toBe(3);
    expect(synced.hpTime).toBe(3);
    expect(synced.persisted).toBe(true);
  });

  it("still syncs resources on an idempotent grant replay", async () => {
    const hero = await createHero();
    await characters.service.noteHp({ characterId: hero.id, hp: 1 });
    const operationId = `test:${hero.id}:regen-replay`;
    await characters.service.grantExperience({
      characterId: hero.id,
      operationId,
      amount: 10,
    });
    clock.advanceSeconds(1);
    const replayed = await characters.service.grantExperience({
      characterId: hero.id,
      operationId,
      amount: 10,
    });
    expect(replayed.expAfter).toBe(11);
    const stored = await characters.service.getByAccountId(hero.accountId);
    expect(stored?.hp).toBe(3);
  });

  it("rolls back a sync that fails in the same unit of work", async () => {
    const hero = await createHero();
    await characters.service.noteHp({ characterId: hero.id, hp: 1 });
    clock.advanceSeconds(1);
    await expect(
      database.run(async () => {
        await characters.service.syncResources({ characterId: hero.id });
        throw new Error("forced rollback");
      }),
    ).rejects.toThrow(/forced rollback/);
    const stored = await characters.service.getByAccountId(hero.accountId);
    expect(stored?.hp).toBe(1);
  });

  it("serializes concurrent syncs through the hero row lock", async () => {
    const hero = await createHero();
    await characters.service.noteHp({ characterId: hero.id, hp: 1 });
    clock.advanceSeconds(1);
    const [first, second] = await Promise.all([
      characters.service.syncResources({ characterId: hero.id }),
      characters.service.syncResources({ characterId: hero.id }),
    ]);
    const stored = await characters.service.getByAccountId(hero.accountId);
    expect(stored?.hp).toBe(3);
    expect([first.hp, second.hp].sort()).toEqual([3, 3]);
  });

  it("pauses regen while the account-keyed fight query reports an active fight", async () => {
    const hero = await createHero();
    const noted = await characters.service.noteHp({ characterId: hero.id, hp: 1 });
    await startHuntWithIssuedId(combat.combat, {
      accountId: hero.accountId,
      heroId: hero.id,
      heroNick: hero.nick,
      heroLevel: hero.level,
      heroKind: hero.kind,
      heroHp: noted.hp,
      heroMaxHp: hero.maxHp,
      heroMp: hero.mp,
      heroMaxMp: hero.maxMp,
      heroStrength: 80,
      botId: 2,
      botNick: "Gryzl",
      botLevel: 1,
      botHp: 20,
      botStrength: 20,
      ...GRYZL_FIGHT_LOOK,
      arena: "2_1",
      areaId: "503",
      loadout: EMPTY_COMBAT_LOADOUT,
      botSpellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
      purpose: "hunt",
      extraEnemies: [],
      allies: [],
      chatWin: "",
      chatLose: "",
    });
    clock.advanceSeconds(5);
    const synced = await characters.service.syncResources({ characterId: hero.id });
    expect(synced).toMatchObject({ hp: 1, hpTime: 0, inActiveFight: true, persisted: false });
    const stored = await characters.service.getByAccountId(hero.accountId);
    expect(stored?.hp).toBe(1);
    expect(stored?.regenAt.getTime()).toBe(noted.regenAt.getTime());
  });

  it("does not persist hp_time when vitals change during an active fight", async () => {
    const hero = await createHero();
    const noted = await characters.service.noteHp({ characterId: hero.id, hp: 1 });
    await startHuntWithIssuedId(combat.combat, {
      accountId: hero.accountId,
      heroId: hero.id,
      heroNick: hero.nick,
      heroLevel: hero.level,
      heroKind: hero.kind,
      heroHp: noted.hp,
      heroMaxHp: hero.maxHp,
      heroMp: hero.mp,
      heroMaxMp: hero.maxMp,
      heroStrength: 80,
      botId: 2,
      botNick: "Gryzl",
      botLevel: 1,
      botHp: 20,
      botStrength: 20,
      ...GRYZL_FIGHT_LOOK,
      arena: "2_1",
      areaId: "503",
      loadout: EMPTY_COMBAT_LOADOUT,
      botSpellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
      purpose: "hunt",
      extraEnemies: [],
      allies: [],
      chatWin: "",
      chatLose: "",
    });
    const locked = await characters.service.lockByAccountId(hero.accountId);
    await characters.service.applyEquipmentVitals(locked, []);
    const stored = await characters.service.getByAccountId(hero.accountId);
    expect(stored?.hp).toBe(1);
    expect(stored?.hpTime).toBe(noted.hpTime);
    expect(stored?.regenAt.getTime()).toBe(noted.regenAt.getTime());
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
