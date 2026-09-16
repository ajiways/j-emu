import { describe, expect, it } from "vitest";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";
import type { FriendlyDuelStartInput } from "../../../src/modules/combat/ports/combat-port.ts";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { createCombatService } from "../../support/create-combat-service.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import {
  unitHuntJoin,
  unitHuntStart,
  UNIT_FIGHT_SECONDARIES,
} from "../../support/hunt-start-input.ts";

describe("CombatService melee turns", () => {
  it("keeps bot-counter and grant off the caster melee poll", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([8, 2]),
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
    });
    const start = await startHuntWithIssuedId(combat, unitHuntStart({ heroStrength: 200 }));
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
    });
    const start = await startHuntWithIssuedId(combat, unitHuntStart({ heroStrength: 200 }));
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
    });
    const start = await startHuntWithIssuedId(
      combat,
      unitHuntStart({ heroStrength: 10, botStrength: 270 }),
    );
    await combat.joinHunt(unitHuntJoin({ fightId: start.fightId }));
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(2, { kind: "poll" });

    await combat.execute(1, { kind: "strike", side: "center", sequence: 2 });
    await combat.execute(1, { kind: "poll" });
    expect(await combat.execute(2, { kind: "poll" })).toEqual([
      expect.objectContaining({ type: "pers-change" }),
    ]);

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

  it("starts the aggro clone duel when the joiner authenticates after pairing", async () => {
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
    const start = await startHuntWithIssuedId(combat, unitHuntStart({ botHp: 50 }));
    await combat.joinHunt(unitHuntJoin({ fightId: start.fightId }));
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "aggro", sequence: 2 });
    await combat.execute(1, { kind: "poll" });

    await combat.execute(2, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    const boot = await combat.execute(2, { kind: "poll" });
    const bootstrap = boot.find((event) => event.type === "hunt-bootstrap");
    if (!bootstrap || bootstrap.type !== "hunt-bootstrap") {
      throw new Error("joiner hunt-bootstrap is missing");
    }
    expect(bootstrap.waiting).toBe(false);
    expect(bootstrap.bot.id).toBe(1_000_001);
    expect(boot.some((event) => event.type === "turn-granted")).toBe(false);

    clock.advanceMs(1400);
    await delay.fireDue(clock.now());
    const bot = await combat.execute(2, { kind: "poll" });
    expect(bot).toEqual([
      expect.objectContaining({ type: "damage", sourceId: 1_000_001, animation: "attack_center" }),
    ]);

    clock.advanceMs(1100);
    await delay.fireDue(clock.now());
    expect(await combat.execute(2, { kind: "poll" })).toEqual([
      { type: "turn-granted", timeoutSeconds: 20 },
    ]);
  });

  it("fans roster HP to the other hunter and waits after a kill while a clone lives", async () => {
    const { combat } = createCombatService({
      random: {
        integer(minInclusive) {
          return minInclusive;
        },
        unit() {
          return 0.4;
        },
      },
    });
    const start = await startHuntWithIssuedId(
      combat,
      unitHuntStart({ heroStrength: 200, botHp: 8 }),
    );
    await combat.joinHunt(unitHuntJoin({ fightId: start.fightId }));
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(2, { kind: "poll" });
    await combat.execute(1, { kind: "aggro", sequence: 2 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "center", sequence: 3 });
    const killer = await combat.execute(1, { kind: "poll" });
    expect(killer.some((event) => event.type === "damage" && event.killed)).toBe(true);
    expect(killer.some((event) => event.type === "opponent-wait")).toBe(true);
    expect(killer.some((event) => event.type === "finished")).toBe(false);
    const other = await combat.execute(2, { kind: "poll" });
    expect(other).toEqual([
      expect.objectContaining({
        type: "pers-change",
        bots: [expect.objectContaining({ id: 1_000_000, hp: 0 })],
      }),
    ]);
  });

  it("grants the paired human after a duel strike without a bot counter", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([1]),
    });
    const fightId = await combat.nextFightId();
    await combat.startFriendlyDuel({
      fightId,
      arena: "1_1",
      areaId: "503",
      instanceCopyId: null,
      fightFlags: null,
      challenger: duelFighter(1, 1),
      acceptor: duelFighter(2, 2),
    });
    await combat.execute(1, { kind: "authenticate", fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(2, { kind: "authenticate", fightId, sequence: 1 });
    await combat.execute(2, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "center", sequence: 2 });
    const melee = await combat.execute(1, { kind: "poll" });
    expect(melee.map((event) => event.type)).toEqual(["turn-wait", "damage", "command-accepted"]);
    expect(melee.some((event) => event.type === "damage" && event.targetId === 2)).toBe(true);
    expect(await combat.execute(2, { kind: "poll" })).toEqual([
      expect.objectContaining({
        type: "pers-change",
        humans: expect.arrayContaining([
          expect.objectContaining({ id: 1 }),
          expect.objectContaining({ id: 2 }),
        ]),
      }),
    ]);

    clock.advanceMs(1400);
    await delay.fireDue(clock.now());
    expect(await combat.execute(1, { kind: "poll" })).toEqual([]);
    expect(await combat.execute(2, { kind: "poll" })).toEqual([]);

    clock.advanceMs(1100);
    await delay.fireDue(clock.now());
    expect(await combat.execute(2, { kind: "poll" })).toEqual([
      { type: "turn-granted", timeoutSeconds: 20 },
    ]);
    expect(await combat.execute(1, { kind: "poll" })).toEqual([]);
  });
});

function duelFighter(accountId: number, heroId: number): FriendlyDuelStartInput["challenger"] {
  return {
    accountId,
    heroId,
    heroNick: `H${heroId}`,
    heroLevel: 1,
    heroKind: 1,
    heroHp: 27,
    heroMaxHp: 27,
    heroMp: 10,
    heroMaxMp: 10,
    heroStrength: 10,
    ...UNIT_FIGHT_SECONDARIES,
    loadout: EMPTY_COMBAT_LOADOUT,
    avatar: "avatar_small.jpg",
    body: "m1",
    sk: "1",
  };
}
