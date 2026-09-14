import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { CombatService } from "../../../src/modules/combat/application/combat-service.ts";
import { FinishedFightCleanup } from "../../../src/modules/combat/application/finished-fight-cleanup.ts";
import { FinishedFightRecorder } from "../../../src/modules/combat/application/finished-fight-recorder.ts";
import { FinishedFightConflictError } from "../../../src/modules/combat/domain/finished-fight-conflict-error.ts";
import { huntFinishedFightRecord } from "../../../src/modules/combat/domain/finished-fight-record.ts";
import { FINISHED_FIGHT_RETENTION_MS } from "../../../src/modules/combat/domain/finished-fight-retention.ts";
import { PostgresFightIdSource } from "../../../src/modules/combat/infrastructure/postgres-fight-id-source.ts";
import { PostgresFinishedFightStore } from "../../../src/modules/combat/infrastructure/postgres-finished-fight-store.ts";
import { PostgresHeroRepository } from "../../../src/modules/character/infrastructure/postgres-hero-repository.ts";
import { PostgresAccountRepository } from "../../../src/modules/identity/infrastructure/postgres-account-repository.ts";
import { playableNewHero } from "../../support/hero-fixtures.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { ManualCombatDelay } from "../../support/fakes/manual-combat-delay.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { RecordingHistoryWriteObserver } from "../../support/fakes/recording-history-write-observer.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  GRYZL_FIGHT_LOOK,
  UNIT_HUNT_APPEARANCE,
  UNIT_HUNT_BATTLE_STATS,
} from "../../support/hunt-start-input.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";

const databaseUrl = requireTestDatabaseUrl();
const now = new Date("2026-09-07T12:00:00.000Z");

describe("finished fight history storage", () => {
  let database: PostgresDatabase;

  beforeAll(async () => {
    database = new PostgresDatabase(databaseUrl);
  });

  afterAll(async () => {
    await database.close();
  });

  it("writes one idempotent row only after a terminal outcome", async () => {
    const { account, hero } = await seedHero(`hist-${crypto.randomUUID()}`);
    const store = new PostgresFinishedFightStore(database);
    const clock = new MutableClock(now);
    const combat = new CombatService(
      new PostgresFightIdSource(database),
      new SequenceRandom([20]),
      UNIT_BATTLE_RULES,
      clock,
      new FinishedFightRecorder(store, clock),
      new RecordingHistoryWriteObserver(),
      new ManualCombatDelay(),
    );
    const start = await startHuntWithIssuedId(combat, {
      accountId: account.id,
      heroId: hero.id,
      heroNick: hero.nick,
      heroLevel: hero.level,
      heroKind: 1,
      heroHp: hero.hp,
      heroMaxHp: hero.maxHp,
      heroMp: hero.mp,
      heroMaxMp: hero.maxMp,
      heroStrength: 200,
      ...UNIT_HUNT_BATTLE_STATS,
      botId: 2,
      botNick: "Грызль",
      botLevel: 1,
      botHp: 20,
      botStrength: 10,
      ...GRYZL_FIGHT_LOOK,
      arena: "1_1",
      areaId: hero.areaId,
      instanceCopyId: null,
      appearance: UNIT_HUNT_APPEARANCE,
      loadout: EMPTY_COMBAT_LOADOUT,
      botSpellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
      purpose: "hunt",
      extraEnemies: [],
      allies: [],
      chatWin: "",
      chatLose: "",
    });
    expect(start.participantId).toBe(hero.id);
    const fightId = BigInt(start.fightId);
    expect(await store.findById(fightId)).toBeNull();
    await combat.execute(account.id, {
      kind: "authenticate",
      fightId: start.fightId,
      sequence: 1,
    });
    expect(await store.findById(fightId)).toBeNull();
    await combat.execute(account.id, { kind: "strike", side: "left", sequence: 2 });
    const first = await store.findById(fightId);
    if (!first) throw new Error("Expected a finished fight row");
    await store.record(first);
    const again = await store.findById(fightId);
    if (!again) throw new Error("Expected the finished fight row to remain");
    expect(again.finishedAt.getTime()).toBe(first.finishedAt.getTime());
    expect(first).toMatchObject({
      id: fightId,
      accountId: account.id,
      heroId: hero.id,
      title: `Нападение ${hero.nick} на Грызль`,
      type: 1,
      timeout: 20,
      levelMin: 1,
      levelMax: 1,
      level: 0,
      winner: 1,
      duration: 0,
      mlTitle: `1|${hero.id}|2`,
    });
    expect(first.teams["1"][0]).toMatchObject({
      id: hero.id,
      nick: hero.nick,
      bot: 0,
      dead: false,
    });
    expect(first.teams["2"][0]).toMatchObject({
      bot: 1,
      artikul_id: "2",
      id: "2",
      nick: "Грызль",
    });
  });

  it("rejects a conflicting duplicate for the same fight id", async () => {
    const { account, hero } = await seedHero(`conflict-${crypto.randomUUID()}`);
    const store = new PostgresFinishedFightStore(database);
    const ids = new PostgresFightIdSource(database);
    const fightId = await ids.nextFightId();
    await store.record(
      huntRow({
        fightId,
        accountId: account.id,
        heroId: hero.id,
        heroNick: hero.nick,
        finishedAt: now,
        winner: 1,
      }),
    );
    await expect(
      store.record(
        huntRow({
          fightId,
          accountId: account.id,
          heroId: hero.id,
          heroNick: hero.nick,
          finishedAt: now,
          winner: 2,
        }),
      ),
    ).rejects.toBeInstanceOf(FinishedFightConflictError);
  });

  it("deletes expired rows in bounded SQL batches and leaves younger rows", async () => {
    const { account, hero } = await seedHero(`ttl-${crypto.randomUUID()}`);
    const store = new PostgresFinishedFightStore(database);
    const ids = new PostgresFightIdSource(database);
    const youngId = BigInt(await ids.nextFightId());
    const oldIds = [
      BigInt(await ids.nextFightId()),
      BigInt(await ids.nextFightId()),
      BigInt(await ids.nextFightId()),
    ];
    await store.record(
      huntRow({
        fightId: youngId.toString(),
        accountId: account.id,
        heroId: hero.id,
        heroNick: hero.nick,
        finishedAt: now,
      }),
    );
    for (const id of oldIds) {
      await store.record(
        huntRow({
          fightId: id.toString(),
          accountId: account.id,
          heroId: hero.id,
          heroNick: hero.nick,
          finishedAt: new Date(now.getTime() - FINISHED_FIGHT_RETENTION_MS - 1_000),
        }),
      );
    }
    const cleanup = new FinishedFightCleanup(store, new MutableClock(now), 2);
    expect(await cleanup.runBatch()).toBe(2);
    expect(await cleanup.runBatch()).toBe(1);
    expect(await cleanup.runBatch()).toBe(0);
    expect(await store.findById(youngId)).not.toBeNull();
    for (const id of oldIds) {
      expect(await store.findById(id)).toBeNull();
    }
  });

  async function seedHero(slug: string) {
    const accounts = new PostgresAccountRepository(database);
    const heroes = new PostgresHeroRepository(database);
    const account = await accounts.create(`hist-${slug}`, `Hist-${slug}`, null);
    const hero = await heroes.create(playableNewHero(account.id, account.nick));
    return { account, hero };
  }
});

function huntRow(input: {
  fightId: string;
  accountId: number;
  heroId: number;
  heroNick: string;
  finishedAt: Date;
  winner?: 1 | 2;
}) {
  return huntFinishedFightRecord({
    fightId: input.fightId,
    accountId: input.accountId,
    heroId: input.heroId,
    heroNick: input.heroNick,
    heroLevel: 1,
    heroKind: 1,
    botArtikulId: 2,
    botNick: "Грызль",
    botLevel: 1,
    timeout: 20,
    areaId: "503",
    winner: input.winner ?? 1,
    startedAt: input.finishedAt,
    finishedAt: input.finishedAt,
  });
}
