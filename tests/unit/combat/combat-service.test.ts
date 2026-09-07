import { describe, expect, it } from "vitest";
import { CombatService } from "../../../src/modules/combat/application/combat-service.ts";
import { FinishedFightRecorder } from "../../../src/modules/combat/application/finished-fight-recorder.ts";
import { MonotonicFightIdSource } from "../../support/fakes/monotonic-fight-id-source.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { RecordingFinishedFightStore } from "../../support/fakes/recording-finished-fight-store.ts";
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
    const combat = service(history, new SequenceRandom([8, 2]), {
      playerDamageMin: 8,
      playerDamageMax: 8,
      botDamageMin: 2,
      botDamageMax: 2,
      turnTimeoutSeconds: 20,
    });
    await combat.startHunt(huntInput());
    expect(await combat.execute("account", { kind: "poll" })).toEqual([]);
    await combat.execute("account", { kind: "authenticate", fightId: "100000", sequence: 1 });
    await combat.execute("account", { kind: "strike", side: "center", sequence: 2 });
    expect(history.records).toEqual([]);
    expect(history.deleted).toEqual([]);
    expect(await combat.execute("account", { kind: "poll" })).not.toHaveLength(0);
    expect(history.records).toEqual([]);
    expect(history.deleted).toEqual([]);
  });

  it("writes history only after a terminal outcome", async () => {
    const history = new RecordingFinishedFightStore();
    const combat = service(history, new SequenceRandom([20]));
    const start = await combat.startHunt(huntInput());
    expect(history.records).toEqual([]);
    await combat.execute("account", { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute("account", { kind: "strike", side: "left", sequence: 2 });
    expect(history.records).toHaveLength(1);
    expect(history.records[0]?.id).toBe(BigInt(start.fightId));
    expect(history.records[0]?.winner).toBe(1);
    expect(history.deleted).toEqual([]);
    await expect(
      combat.execute("account", { kind: "strike", side: "left", sequence: 3 }),
    ).rejects.toThrow(/Active fight not found/);
    expect(history.records).toHaveLength(1);
    expect(history.deleted).toEqual([]);
  });
});

function service(
  history: RecordingFinishedFightStore,
  random: SequenceRandom,
  battleRules = rules,
): CombatService {
  return new CombatService(
    new MonotonicFightIdSource(100_000, 200_000),
    random,
    battleRules,
    new MutableClock(new Date("2026-09-07T12:00:00.000Z")),
    new FinishedFightRecorder(history, new MutableClock(new Date("2026-09-07T12:00:10.000Z"))),
  );
}

function huntInput() {
  return {
    accountId: "account",
    heroId: "hero",
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
