import { describe, expect, it } from "vitest";
import { CombatService } from "../../../src/modules/combat/application/combat-service.ts";
import { FinishedFightRecorder } from "../../../src/modules/combat/application/finished-fight-recorder.ts";
import { FailingFinishedFightStore } from "../../support/fakes/failing-finished-fight-store.ts";
import { ManualCombatDelay } from "../../support/fakes/manual-combat-delay.ts";
import { MonotonicFightIdSource } from "../../support/fakes/monotonic-fight-id-source.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { RecordingFinishedFightStore } from "../../support/fakes/recording-finished-fight-store.ts";
import { RecordingHistoryWriteObserver } from "../../support/fakes/recording-history-write-observer.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { fightLootBlock } from "../../../src/modules/combat/domain/fight-loot-block.ts";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { battleRules } from "../../support/create-combat-service.ts";
import { unitHuntStart } from "../../support/hunt-start-input.ts";

const rules = battleRules();

describe("CombatService history", () => {
  it("does not touch history storage on poll or a non-terminal strike", async () => {
    const history = new RecordingFinishedFightStore();
    const writes = new RecordingHistoryWriteObserver();
    const combat = service(history, writes, new SequenceRandom([8, 2]));
    await startHuntWithIssuedId(combat, huntInput());
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
    const start = await startHuntWithIssuedId(combat, huntInput({ heroStrength: 200 }));
    expect(history.records).toEqual([]);
    expect(start.participantId).toBe(1);
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    expect(history.records).toHaveLength(1);
    expect(history.records[0]?.id).toBe(BigInt(start.fightId));
    expect(history.records[0]?.winner).toBe(1);
    expect(history.records[0]?.heroId).toBe(1);
    expect(history.deleted).toEqual([]);
    await combat.execute(1, { kind: "strike", side: "left", sequence: 3 });
    expect(await combat.execute(1, { kind: "poll" })).toEqual(
      expect.arrayContaining([{ type: "command-accepted", sequence: 3 }]),
    );
    expect(history.records).toHaveLength(1);
    expect(history.deleted).toEqual([]);
    expect(writes.events).toEqual([]);
  });

  it("releases esrv loot if poll takes fightFinish before persistFinished returns", async () => {
    let enteredPersist: () => void = () => {
      throw new Error("persistFinished was not entered");
    };
    const persistEntered = new Promise<void>((resolve) => {
      enteredPersist = resolve;
    });
    let resumePersist: () => void = () => {
      throw new Error("persistFinished gate is missing");
    };
    const persistGate = new Promise<void>((resolve) => {
      resumePersist = resolve;
    });
    const combat = service(
      new RecordingFinishedFightStore(),
      new RecordingHistoryWriteObserver(),
      new SequenceRandom([20]),
    );
    combat.bindSettlement({
      persistHumanLeft: async () => {
        throw new Error("persistHumanLeft must not run on a hunt win");
      },
      persistFinished: async (outcome) => {
        enteredPersist();
        await persistGate;
        return new Map([
          [
            1,
            fightLootBlock({
              fightId: outcome.fightId,
              experience: 15,
              money: "0.2",
              items: [],
              artikulList: [],
            }),
          ],
        ]);
      },
      publishEnded: async () => {},
    });
    const start = await startHuntWithIssuedId(combat, huntInput({ heroStrength: 200 }));
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    const striking = combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    await persistEntered;
    const events = await combat.execute(1, { kind: "poll" });
    expect(events.some((event) => event.type === "finished")).toBe(true);
    expect(await combat.peekExit(1)).toBeNull();
    expect(await combat.peekLoot(1)).toBeNull();
    resumePersist();
    await striking;
    expect(await combat.takeExit(1)).toEqual({ fightId: start.fightId, winnerTeam: 1 });
    expect(await combat.takeLoot(1)).toMatchObject({
      status: 100,
      fight_id: Number(start.fightId),
      experience: 15,
    });
  });

  it("still emits terminal packets when history storage is unavailable", async () => {
    const writes = new RecordingHistoryWriteObserver();
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const combat = new CombatService(
      new MonotonicFightIdSource(1),
      new SequenceRandom([20]),
      rules,
      clock,
      new FinishedFightRecorder(
        new FailingFinishedFightStore(new Error("history storage unavailable")),
        new MutableClock(new Date("2026-09-07T12:00:10.000Z")),
      ),
      writes,
      new ManualCombatDelay(),
    );
    const start = await startHuntWithIssuedId(combat, huntInput({ heroStrength: 200 }));
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
    );
    const start = await startHuntWithIssuedId(combat, huntInput());
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    const events = await combat.execute(1, { kind: "poll" });
    const bootstrap = events.find((event) => event.type === "hunt-bootstrap");
    if (!bootstrap || bootstrap.type !== "hunt-bootstrap") {
      throw new Error("Expected a hunt bootstrap packet");
    }
    expect(bootstrap.bot.id).toBeGreaterThanOrEqual(1_000_000);
    expect(bootstrap.bot.id).not.toBe(start.participantId);
  });
});

function service(
  history: RecordingFinishedFightStore,
  writes: RecordingHistoryWriteObserver,
  random: SequenceRandom,
  battleRulesValue = rules,
): CombatService {
  const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
  return new CombatService(
    new MonotonicFightIdSource(1),
    random,
    battleRulesValue,
    clock,
    new FinishedFightRecorder(history, clock),
    writes,
    new ManualCombatDelay(),
  );
}

function huntInput(overrides: Parameters<typeof unitHuntStart>[0] = {}) {
  return unitHuntStart(overrides);
}
