import { describe, expect, it } from "vitest";
import { CombatService } from "../../../src/modules/combat/application/combat-service.ts";
import { FinishedFightRecorder } from "../../../src/modules/combat/application/finished-fight-recorder.ts";
import { FailingFinishedFightStore } from "../../support/fakes/failing-finished-fight-store.ts";
import { MonotonicFightIdSource } from "../../support/fakes/monotonic-fight-id-source.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { RecordingFinishedFightStore } from "../../support/fakes/recording-finished-fight-store.ts";
import { RecordingHistoryWriteObserver } from "../../support/fakes/recording-history-write-observer.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

const rules = {
  playerDamageMin: 20,
  playerDamageMax: 20,
  botDamageMin: 2,
  botDamageMax: 2,
  turnTimeoutSeconds: 20,
};

describe("CombatService history", () => {
  it("does not touch history storage on poll or a non-terminal strike", async () => {
    const history = new RecordingFinishedFightStore();
    const writes = new RecordingHistoryWriteObserver();
    const combat = service(history, writes, new SequenceRandom([8, 2]), {
      playerDamageMin: 8,
      playerDamageMax: 8,
      botDamageMin: 2,
      botDamageMax: 2,
      turnTimeoutSeconds: 20,
    });
    await combat.startHunt(huntInput());
    expect(await combat.execute(1, { kind: "poll" })).toEqual([]);
    await combat.execute(1, { kind: "authenticate", fightId: "1", sequence: 1 });
    await combat.execute(1, { kind: "strike", side: "center", sequence: 2 });
    expect(history.records).toEqual([]);
    expect(history.deleted).toEqual([]);
    expect(await combat.execute(1, { kind: "poll" })).not.toHaveLength(0);
    expect(history.records).toEqual([]);
    expect(history.deleted).toEqual([]);
    expect(writes.events).toEqual([]);
  });

  it("writes history only after a terminal outcome", async () => {
    const history = new RecordingFinishedFightStore();
    const writes = new RecordingHistoryWriteObserver();
    const combat = service(history, writes, new SequenceRandom([20]));
    const start = await combat.startHunt(huntInput());
    expect(history.records).toEqual([]);
    expect(start.participantId).toBe(1);
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    expect(history.records).toHaveLength(1);
    expect(history.records[0]?.id).toBe(BigInt(start.fightId));
    expect(history.records[0]?.winner).toBe(1);
    expect(history.records[0]?.heroId).toBe(1);
    expect(history.deleted).toEqual([]);
    await expect(combat.execute(1, { kind: "strike", side: "left", sequence: 3 })).rejects.toThrow(
      /Active fight not found/,
    );
    expect(history.records).toHaveLength(1);
    expect(history.deleted).toEqual([]);
    expect(writes.events).toEqual([]);
  });

  it("still emits terminal packets when history storage is unavailable", async () => {
    const writes = new RecordingHistoryWriteObserver();
    const combat = new CombatService(
      new MonotonicFightIdSource(1),
      new SequenceRandom([20]),
      rules,
      new MutableClock(new Date("2026-09-07T12:00:00.000Z")),
      new FinishedFightRecorder(
        new FailingFinishedFightStore(new Error("history storage unavailable")),
        new MutableClock(new Date("2026-09-07T12:00:10.000Z")),
      ),
      writes,
    );
    const start = await combat.startHunt(huntInput());
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    const events = await combat.execute(1, { kind: "poll" });
    expect(events.some((event) => event.type === "finished")).toBe(true);
    expect(writes.events).toEqual([
      { kind: "failed", fightId: start.fightId, error: "history storage unavailable" },
    ]);
    expect(await combat.takeExit(1)).toEqual({ fightId: start.fightId, winnerTeam: 1 });
  });

  it("issues RAM bot ids from 1000000 that do not collide with the hero", async () => {
    const combat = service(
      new RecordingFinishedFightStore(),
      new RecordingHistoryWriteObserver(),
      new SequenceRandom([8, 2]),
      {
        playerDamageMin: 8,
        playerDamageMax: 8,
        botDamageMin: 2,
        botDamageMax: 2,
        turnTimeoutSeconds: 20,
      },
    );
    const start = await combat.startHunt(huntInput());
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    const events = await combat.execute(1, { kind: "poll" });
    const opponent = events.find((event) => event.type === "opponent-introduced");
    if (!opponent || opponent.type !== "opponent-introduced") {
      throw new Error("Expected an opponent packet");
    }
    expect(opponent.id).toBeGreaterThanOrEqual(1_000_000);
    expect(opponent.id).not.toBe(start.participantId);
  });
});

function service(
  history: RecordingFinishedFightStore,
  writes: RecordingHistoryWriteObserver,
  random: SequenceRandom,
  battleRules = rules,
): CombatService {
  return new CombatService(
    new MonotonicFightIdSource(1),
    random,
    battleRules,
    new MutableClock(new Date("2026-09-07T12:00:00.000Z")),
    new FinishedFightRecorder(history, new MutableClock(new Date("2026-09-07T12:00:10.000Z"))),
    writes,
  );
}

function huntInput() {
  return {
    accountId: 1,
    heroId: 1,
    heroNick: "Hero",
    heroLevel: 1,
    heroKind: 1,
    heroHp: 27,
    botId: 2,
    botNick: "Грызль",
    botLevel: 1,
    botHp: 20,
    arena: "1_1",
    areaId: "503",
  };
}
