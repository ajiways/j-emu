import { describe, expect, it } from "vitest";
import { CombatService } from "../../../src/modules/combat/application/combat-service.ts";
import { FinishedFightRecorder } from "../../../src/modules/combat/application/finished-fight-recorder.ts";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { unitHuntJoin, unitHuntStart } from "../../support/hunt-start-input.ts";
import { MonotonicFightIdSource } from "../../support/fakes/monotonic-fight-id-source.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { RecordingFinishedFightStore } from "../../support/fakes/recording-finished-fight-store.ts";
import { RecordingHistoryWriteObserver } from "../../support/fakes/recording-history-write-observer.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { battleRules } from "../../support/create-combat-service.ts";
import { ManualCombatDelay } from "../../support/fakes/manual-combat-delay.ts";

const rules = battleRules();

describe("CombatService hunt join", () => {
  it("joins the same fight id and queues roster to authed humans", async () => {
    const combat = service();
    const start = await startHuntWithIssuedId(combat, unitHuntStart({ heroStrength: 200 }));
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    const joined = await combat.joinHunt(unitHuntJoin({ fightId: start.fightId }));
    expect(joined.fightId).toBe(start.fightId);
    expect(joined.accessKey).toBe(start.accessKey);
    expect(joined.participantId).toBe(2);
    const openerRoster = await combat.execute(1, { kind: "poll" });
    expect(openerRoster.some((event) => event.type === "roster-updated")).toBe(true);
    await combat.execute(2, { kind: "authenticate", fightId: joined.fightId, sequence: 1 });
    const joinerEvents = await combat.execute(2, { kind: "poll" });
    const bootstrap = joinerEvents.find((event) => event.type === "hunt-bootstrap");
    if (!bootstrap || bootstrap.type !== "hunt-bootstrap") {
      throw new Error("Expected joiner hunt bootstrap");
    }
    expect(bootstrap.waiting).toBe(true);
    expect(joinerEvents.some((event) => event.type === "turn-granted")).toBe(false);
  });

  it("denies already-in-fight, missing fight, other area, and rejoin", async () => {
    const combat = service();
    const start = await startHuntWithIssuedId(combat, unitHuntStart({ heroStrength: 200 }));
    await expect(
      combat.joinHunt(unitHuntJoin({ accountId: 1, heroId: 1, fightId: start.fightId })),
    ).rejects.toMatchObject({ name: "HuntJoinDenied", message: "уже в бою" });
    await expect(combat.joinHunt(unitHuntJoin({ fightId: "9" }))).rejects.toMatchObject({
      name: "HuntJoinDenied",
      message: "бой не найден",
    });
    await expect(
      combat.joinHunt(unitHuntJoin({ fightId: start.fightId, areaId: "504" })),
    ).rejects.toMatchObject({ message: "бой в другой локации" });
    const joined = await combat.joinHunt(unitHuntJoin({ fightId: start.fightId }));
    expect(joined.fightId).toBe(start.fightId);
    await expect(
      combat.joinHunt(unitHuntJoin({ accountId: 3, heroId: 2, fightId: start.fightId })),
    ).rejects.toMatchObject({ message: "вы уже участвовали в этом бою" });
  });

  it("finishes every account on the shared battle", async () => {
    const combat = service();
    const start = await startHuntWithIssuedId(combat, unitHuntStart({ heroStrength: 200 }));
    await combat.joinHunt(unitHuntJoin({ fightId: start.fightId }));
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    const joinerEvents = await combat.execute(2, { kind: "poll" });
    expect(joinerEvents.some((event) => event.type === "finished")).toBe(true);
    expect(await combat.takeExit(1)).toEqual({ fightId: start.fightId, winnerTeam: 1 });
    expect(await combat.takeExit(2)).toEqual({ fightId: start.fightId, winnerTeam: 1 });
    expect(await combat.hasFight(start.fightId)).toBe(false);
  });

  it("joins team 2 on the same fight and rejects a copy mismatch", async () => {
    const combat = service();
    const start = await startHuntWithIssuedId(
      combat,
      unitHuntStart({ heroStrength: 200, instanceCopyId: 7 }),
    );
    await expect(
      combat.joinHunt(unitHuntJoin({ fightId: start.fightId, instanceCopyId: 8, team: 2 })),
    ).rejects.toMatchObject({ name: "HuntJoinDenied", message: "бой в другой локации" });
    const joined = await combat.joinHunt(
      unitHuntJoin({ fightId: start.fightId, instanceCopyId: 7, team: 2 }),
    );
    expect(joined.fightId).toBe(start.fightId);
    expect(await combat.participantTeam(2)).toBe(2);
    expect(await combat.participantTeam(1)).toBe(1);
  });

  it("keeps the fight open after the bot dies while team 2 waits", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const delay = new ManualCombatDelay();
    const combat = new CombatService(
      new MonotonicFightIdSource(1),
      new SequenceRandom([20, 8]),
      rules,
      clock,
      new FinishedFightRecorder(new RecordingFinishedFightStore(), clock),
      new RecordingHistoryWriteObserver(),
      delay,
    );
    const start = await startHuntWithIssuedId(combat, unitHuntStart({ heroStrength: 200 }));
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.joinHunt(unitHuntJoin({ fightId: start.fightId, team: 2 }));
    await combat.execute(2, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(2, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    const openerEvents = await combat.execute(1, { kind: "poll" });
    expect(openerEvents.some((event) => event.type === "finished")).toBe(false);
    expect(openerEvents.some((event) => event.type === "opponent-new-human")).toBe(true);
    const joinerEvents = await combat.execute(2, { kind: "poll" });
    expect(joinerEvents.some((event) => event.type === "opponent-new-human")).toBe(true);
    clock.advanceMs(2500);
    await delay.fireDue(clock.now());
    const granted = await combat.execute(2, { kind: "poll" });
    expect(granted.some((event) => event.type === "turn-granted")).toBe(true);
    await combat.execute(2, { kind: "strike", side: "left", sequence: 2 });
    const intervene = await combat.execute(2, { kind: "poll" });
    expect(intervene.some((event) => event.type === "damage")).toBe(true);
    expect(await combat.hasFight(start.fightId)).toBe(true);
  });

  it("pairs team-2 with a team-1 waiter without cancelling the opener bot delay", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const delay = new ManualCombatDelay();
    const combat = new CombatService(
      new MonotonicFightIdSource(1),
      new SequenceRandom([8, 2]),
      rules,
      clock,
      new FinishedFightRecorder(new RecordingFinishedFightStore(), clock),
      new RecordingHistoryWriteObserver(),
      delay,
    );
    const start = await startHuntWithIssuedId(combat, unitHuntStart());
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.joinHunt(unitHuntJoin({ fightId: start.fightId, team: 1 }));
    await combat.execute(2, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(2, { kind: "poll" });
    await combat.joinHunt(
      unitHuntJoin({
        accountId: 3,
        heroId: 3,
        heroNick: "Intervenor",
        fightId: start.fightId,
        team: 2,
      }),
    );
    const waiterEvents = await combat.execute(2, { kind: "poll" });
    expect(waiterEvents.some((event) => event.type === "opponent-new-human")).toBe(true);
    await combat.execute(3, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    const joinerEvents = await combat.execute(3, { kind: "poll" });
    const bootstrap = joinerEvents.find((event) => event.type === "hunt-bootstrap");
    if (!bootstrap || bootstrap.type !== "hunt-bootstrap") {
      throw new Error("Expected team-2 hunt bootstrap");
    }
    expect(bootstrap.waiting).toBe(false);
    expect(bootstrap.humanOpponent).toMatchObject({ id: 2, team: 1 });
    expect(joinerEvents.some((event) => event.type === "turn-granted")).toBe(false);
    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    clock.advanceMs(2500);
    await delay.fireDue(clock.now());
    const openerEvents = await combat.execute(1, { kind: "poll" });
    expect(openerEvents.some((event) => event.type === "damage")).toBe(true);
    expect(openerEvents.some((event) => event.type === "finished")).toBe(false);
    const granted = await combat.execute(2, { kind: "poll" });
    expect(granted.some((event) => event.type === "turn-granted")).toBe(true);
    expect(await combat.hasFight(start.fightId)).toBe(true);
  });
});

function service(): CombatService {
  const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
  return new CombatService(
    new MonotonicFightIdSource(1),
    new SequenceRandom([20]),
    rules,
    clock,
    new FinishedFightRecorder(new RecordingFinishedFightStore(), clock),
    new RecordingHistoryWriteObserver(),
    new ManualCombatDelay(),
  );
}
