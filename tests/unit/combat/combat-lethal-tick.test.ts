import { describe, expect, it } from "vitest";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { createCombatService } from "../../support/create-combat-service.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { unitHissaSpitBook, unitHuntJoin, unitHuntStart } from "../../support/hunt-start-input.ts";

const HISSA = {
  botId: 4,
  botNick: "Хисса",
  botStrength: 15,
  botSpellBook: unitHissaSpitBook(),
  heroHp: 2,
  heroMaxHp: 27,
} as const;

describe("CombatService lethal DoT tick on the striker", () => {
  it("ends the fight when the tick kills the last hunter", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([8, 0.95, 1, 8, 1]),
    });
    const start = await startHuntWithIssuedId(combat, unitHuntStart(HISSA));
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    await combat.execute(1, { kind: "poll" });
    clock.advanceMs(1400);
    await delay.fireDue(clock.now());
    await combat.execute(1, { kind: "poll" });
    clock.advanceMs(1100);
    await delay.fireDue(clock.now());
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "center", sequence: 3 });
    const melee = await combat.execute(1, { kind: "poll" });
    expect(melee.map((event) => event.type)).toEqual([
      "turn-wait",
      "damage",
      "damage",
      "command-accepted",
      "finished",
    ]);
    expect(melee[2]).toMatchObject({ animation: "", targetId: 1, hpChange: -1, killed: true });
    expect(melee[4]).toMatchObject({ type: "finished", winnerTeam: 2 });
    expect(await combat.hasFight(start.fightId)).toBe(false);
  });

  it("hands the bot to a waiting ally when the tick kills the paired hunter", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([8, 0.95, 1, 8, 1]),
    });
    const start = await startHuntWithIssuedId(combat, unitHuntStart(HISSA));
    await combat.joinHunt(unitHuntJoin({ fightId: start.fightId }));
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(2, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "poll" });
    clock.advanceMs(1400);
    await delay.fireDue(clock.now());
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "poll" });
    clock.advanceMs(1100);
    await delay.fireDue(clock.now());
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "center", sequence: 3 });
    const melee = await combat.execute(1, { kind: "poll" });
    expect(melee.map((event) => event.type)).toEqual([
      "turn-wait",
      "damage",
      "damage",
      "command-accepted",
      "finished",
    ]);
    expect(melee[2]).toMatchObject({ animation: "", targetId: 1, killed: true });
    expect(melee[4]).toMatchObject({ type: "finished", winnerTeam: 2 });
    const waiter = await combat.execute(2, { kind: "poll" });
    expect(waiter.some((event) => event.type === "opponent-new")).toBe(true);
    expect(await combat.hasFight(start.fightId)).toBe(true);
  });
});
