import { describe, expect, it } from "vitest";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { createCombatService, battleRules } from "../../support/create-combat-service.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { unitHuntJoin, unitHuntStart } from "../../support/hunt-start-input.ts";

describe("CombatService melee turns", () => {
  it("keeps bot-counter and grant off the caster melee poll", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([8, 2]),
      rules: battleRules({
        playerDamageMin: 8,
        playerDamageMax: 8,
        botDamageMin: 2,
        botDamageMax: 2,
      }),
    });
    await startHuntWithIssuedId(combat, unitHuntStart());
    await combat.execute(1, { kind: "authenticate", fightId: "1", sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    const melee = await combat.execute(1, { kind: "poll" });
    expect(melee.map((event) => event.type)).toEqual(["turn-wait", "damage", "command-accepted"]);
    expect(melee.some((event) => event.type === "turn-granted")).toBe(false);

    clock.advanceMs(1400);
    await delay.fireDue(clock.now());
    const bot = await combat.execute(1, { kind: "poll" });
    expect(bot).toHaveLength(1);
    expect(bot[0]).toMatchObject({
      type: "damage",
      animation: "attack_center",
      sourceId: 1_000_000,
    });

    clock.advanceMs(1100);
    await delay.fireDue(clock.now());
    const grant = await combat.execute(1, { kind: "poll" });
    expect(grant).toEqual([{ type: "turn-granted", timeoutSeconds: 20 }]);
  });

  it("ignores off-turn, waiter, and already-ended strikes", async () => {
    const { combat } = createCombatService({
      random: new SequenceRandom([20]),
      rules: battleRules({ playerDamageMin: 20, playerDamageMax: 20 }),
    });
    const start = await startHuntWithIssuedId(combat, unitHuntStart());
    await combat.joinHunt(unitHuntJoin({ fightId: start.fightId }));
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(2, { kind: "poll" });

    await combat.execute(2, { kind: "strike", side: "center", sequence: 2 });
    const waiter = await combat.execute(2, { kind: "poll" });
    expect(waiter).toEqual([{ type: "command-accepted", sequence: 2 }]);
    expect(waiter.some((event) => event.type === "damage")).toBe(false);

    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 3 });
    const ignored = await combat.execute(1, { kind: "poll" });
    expect(ignored).toEqual([{ type: "command-accepted", sequence: 3 }]);
    expect(await combat.hasFight(start.fightId)).toBe(false);
  });

  it("cancels grant on a killing blow and does not emit attacknow", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([20]),
      rules: battleRules({ playerDamageMin: 20, playerDamageMax: 20 }),
    });
    const start = await startHuntWithIssuedId(combat, unitHuntStart());
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "right", sequence: 2 });
    const melee = await combat.execute(1, { kind: "poll" });
    expect(melee.map((event) => event.type)).toEqual([
      "turn-wait",
      "damage",
      "command-accepted",
      "finished",
    ]);
    const damage = melee.find((event) => event.type === "damage");
    expect(damage).toMatchObject({ killed: true, animation: "attack_right" });
    expect(melee.some((event) => event.type === "turn-granted")).toBe(false);

    clock.advanceMs(2500);
    await delay.fireDue(clock.now());
    expect(await combat.execute(1, { kind: "poll" })).toEqual([]);
  });

  it("hands a live bot to an authed waiter after the paired hunter dies", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([1, 27]),
      rules: battleRules({
        playerDamageMin: 1,
        playerDamageMax: 1,
        botDamageMin: 27,
        botDamageMax: 27,
        meleeBotCounterMs: 1400,
        turnGrantDelayMs: 2500,
      }),
    });
    const start = await startHuntWithIssuedId(combat, unitHuntStart());
    await combat.joinHunt(unitHuntJoin({ fightId: start.fightId }));
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(2, { kind: "poll" });

    await combat.execute(1, { kind: "strike", side: "center", sequence: 2 });
    await combat.execute(1, { kind: "poll" });
    expect(await combat.execute(2, { kind: "poll" })).toEqual([]);

    clock.advanceMs(1400);
    await delay.fireDue(clock.now());
    const dead = await combat.execute(1, { kind: "poll" });
    expect(dead.some((event) => event.type === "finished")).toBe(true);
    const waiter = await combat.execute(2, { kind: "poll" });
    expect(waiter.some((event) => event.type === "opponent-new")).toBe(true);
    expect(waiter.some((event) => event.type === "turn-granted")).toBe(false);

    clock.advanceMs(2500);
    await delay.fireDue(clock.now());
    expect(await combat.execute(2, { kind: "poll" })).toEqual([
      { type: "turn-granted", timeoutSeconds: 20 },
    ]);
    expect(await combat.execute(1, { kind: "poll" })).toEqual([]);
  });
});
