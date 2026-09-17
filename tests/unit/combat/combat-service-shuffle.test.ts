import { describe, expect, it } from "vitest";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { createCombatService } from "../../support/create-combat-service.ts";
import { unitHuntJoin, unitHuntStart } from "../../support/hunt-start-input.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";

describe("CombatService 3↔3 shuffle", () => {
  it("gives the waiter oppnew after three exchanges and keeps HP", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([1, 1, 1, 1, 1, 1]),
    });
    const start = await startHuntWithIssuedId(
      combat,
      unitHuntStart({ heroStrength: 10, botStrength: 10, botHp: 50 }),
    );
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.joinHunt(
      unitHuntJoin({ fightId: start.fightId, heroStrength: 10, heroHp: 27, heroMaxHp: 27 }),
    );
    await combat.execute(2, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(2, { kind: "poll" });
    for (let round = 0; round < 3; round += 1) {
      await combat.execute(1, { kind: "strike", side: "center", sequence: 10 + round });
      await combat.execute(1, { kind: "poll" });
      clock.advanceMs(1400);
      await delay.fireDue(clock.now());
      const afterBot = await combat.execute(1, { kind: "poll" });
      if (round === 2) {
        expect(afterBot.some((event) => event.type === "opponent-wait")).toBe(true);
        break;
      }
      clock.advanceMs(1100);
      await delay.fireDue(clock.now());
      await combat.execute(1, { kind: "poll" });
    }
    const waiter = await combat.execute(2, { kind: "poll" });
    expect(waiter.some((event) => event.type === "opponent-new")).toBe(true);
    expect(await combat.hasFight(start.fightId)).toBe(true);
  });

  it("counts an AFK skip as a pair hit and hands the waiter after 3↔3", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([1, 1, 1]),
    });
    const start = await startHuntWithIssuedId(
      combat,
      unitHuntStart({ heroStrength: 10, botStrength: 10, botHp: 50 }),
    );
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.joinHunt(
      unitHuntJoin({ fightId: start.fightId, heroStrength: 10, heroHp: 27, heroMaxHp: 27 }),
    );
    await combat.execute(2, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(2, { kind: "poll" });
    for (let round = 0; round < 3; round += 1) {
      clock.advanceMs(20_000);
      await delay.fireDue(clock.now());
      const skipped = await combat.execute(1, { kind: "poll" });
      expect(skipped.some((event) => event.type === "turn-timeout")).toBe(true);
      if (round === 2) {
        expect(skipped.some((event) => event.type === "opponent-wait")).toBe(true);
        break;
      }
      clock.advanceMs(2500);
      await delay.fireDue(clock.now());
      await combat.execute(1, { kind: "poll" });
    }
    const waiter = await combat.execute(2, { kind: "poll" });
    expect(waiter.some((event) => event.type === "opponent-new")).toBe(true);
  });

  it("lets the waiter finish Gryzl after the 3↔3 handoff", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom(Array.from({ length: 80 }, () => 1)),
    });
    const start = await startHuntWithIssuedId(
      combat,
      unitHuntStart({ heroStrength: 10, botStrength: 10, botHp: 20 }),
    );
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.joinHunt(
      unitHuntJoin({ fightId: start.fightId, heroStrength: 10, heroHp: 27, heroMaxHp: 27 }),
    );
    await combat.execute(2, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(2, { kind: "poll" });
    let striker = 1;
    let finished = false;
    for (let strike = 0; strike < 40 && !finished; strike += 1) {
      await combat.execute(striker, { kind: "strike", side: "center", sequence: 20 + strike });
      const melee = await combat.execute(striker, { kind: "poll" });
      if (melee.some((event) => event.type === "finished")) {
        finished = true;
        break;
      }
      clock.advanceMs(1400);
      await delay.fireDue(clock.now());
      const afterBot = await combat.execute(striker, { kind: "poll" });
      const otherId = striker === 1 ? 2 : 1;
      const ally = await combat.execute(otherId, { kind: "poll" });
      if (
        afterBot.some((event) => event.type === "finished") ||
        ally.some((event) => event.type === "finished")
      ) {
        finished = true;
        break;
      }
      if (
        afterBot.some((event) => event.type === "opponent-wait") ||
        ally.some((event) => event.type === "opponent-new")
      ) {
        clock.advanceMs(2500);
        await delay.fireDue(clock.now());
        await combat.execute(otherId, { kind: "poll" });
        striker = otherId;
        continue;
      }
      clock.advanceMs(1100);
      await delay.fireDue(clock.now());
      await combat.execute(striker, { kind: "poll" });
    }
    expect(finished).toBe(true);
    expect(await combat.hasFight(start.fightId)).toBe(false);
  });

  it("keeps the other hunter's grant after a 3↔3 reserve-swap", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: {
        integer(minInclusive) {
          return minInclusive;
        },
        unit() {
          return 0.99;
        },
      },
    });
    const start = await startHuntWithIssuedId(
      combat,
      unitHuntStart({
        heroStrength: 10,
        botStrength: 10,
        botHp: 50,
        heroAggroCharges: 2,
      }),
    );
    await combat.joinHunt(
      unitHuntJoin({ fightId: start.fightId, heroStrength: 10, heroHp: 27, heroMaxHp: 27 }),
    );
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(2, { kind: "poll" });
    await combat.execute(1, { kind: "aggro", targetId: 1_000_000, sequence: 2 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "poll" });
    await combat.execute(1, { kind: "aggro", targetId: 1_000_000, sequence: 3 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "poll" });
    clock.advanceMs(2500);
    await delay.fireDue(clock.now());
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "poll" });
    for (let round = 0; round < 2; round += 1) {
      await combat.execute(1, { kind: "strike", side: "center", sequence: 10 + round });
      await combat.execute(1, { kind: "poll" });
      clock.advanceMs(1400);
      await delay.fireDue(clock.now());
      await combat.execute(1, { kind: "poll" });
      clock.advanceMs(1100);
      await delay.fireDue(clock.now());
      await combat.execute(1, { kind: "poll" });
    }
    await combat.execute(2, { kind: "strike", side: "center", sequence: 20 });
    await combat.execute(2, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "center", sequence: 12 });
    await combat.execute(1, { kind: "poll" });
    clock.advanceMs(1400);
    await delay.fireDue(clock.now());
    const swapped = await combat.execute(1, { kind: "poll" });
    expect(swapped.some((event) => event.type === "opponent-new")).toBe(true);
    await combat.execute(2, { kind: "poll" });
    clock.advanceMs(1100);
    await delay.fireDue(clock.now());
    expect(await combat.execute(2, { kind: "poll" })).toEqual([
      { type: "turn-granted", timeoutSeconds: 20 },
    ]);
  });

  it("does not let a leftover bot-counter hit after 3↔3 cross-swap", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: {
        integer(minInclusive) {
          return minInclusive;
        },
        unit() {
          return 0.99;
        },
      },
    });
    const start = await startHuntWithIssuedId(
      combat,
      unitHuntStart({ heroStrength: 10, botStrength: 10, botHp: 50 }),
    );
    await combat.joinHunt(
      unitHuntJoin({ fightId: start.fightId, heroStrength: 10, heroHp: 27, heroMaxHp: 27 }),
    );
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(2, { kind: "poll" });
    await combat.execute(1, { kind: "aggro", targetId: 1_000_000, sequence: 2 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "poll" });
    clock.advanceMs(2500);
    await delay.fireDue(clock.now());
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "poll" });
    for (let round = 0; round < 2; round += 1) {
      await combat.execute(1, { kind: "strike", side: "center", sequence: 10 + round });
      await combat.execute(1, { kind: "poll" });
      await combat.execute(2, { kind: "strike", side: "center", sequence: 10 + round });
      await combat.execute(2, { kind: "poll" });
      clock.advanceMs(1400);
      await delay.fireDue(clock.now());
      await combat.execute(1, { kind: "poll" });
      await combat.execute(2, { kind: "poll" });
      clock.advanceMs(1100);
      await delay.fireDue(clock.now());
      await combat.execute(1, { kind: "poll" });
      await combat.execute(2, { kind: "poll" });
    }
    await combat.execute(1, { kind: "strike", side: "center", sequence: 12 });
    await combat.execute(1, { kind: "poll" });
    clock.advanceMs(1400);
    await delay.fireDue(clock.now());
    await combat.execute(1, { kind: "poll" });
    clock.advanceMs(1100);
    await delay.fireDue(clock.now());
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "center", sequence: 13 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "strike", side: "center", sequence: 12 });
    const swapped = await combat.execute(2, { kind: "poll" });
    expect(swapped.some((event) => event.type === "opponent-new")).toBe(true);
    await combat.execute(1, { kind: "poll" });
    clock.advanceMs(1400);
    await delay.fireDue(clock.now());
    expect(await combat.execute(1, { kind: "poll" })).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "damage" })]),
    );
    expect(await combat.execute(2, { kind: "poll" })).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "damage" })]),
    );
  });
});
