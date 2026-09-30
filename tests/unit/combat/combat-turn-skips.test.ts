import { describe, expect, it } from "vitest";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { createCombatService } from "../../support/create-combat-service.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  unitHuntSpellCard,
  unitHuntStart,
} from "../../support/hunt-start-input.ts";

const START = new Date("2026-09-07T12:00:00.000Z");

describe("CombatService AFK skips", () => {
  it("kills a hunter who skips three turns in a row and ends a one-man fight", async () => {
    const clock = new MutableClock(START);
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([2, 2, 2]),
    });
    const start = await startHuntWithIssuedId(combat, unitHuntStart());
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });

    for (const skip of [1, 2]) {
      clock.advanceMs(20_000);
      await delay.fireDue(clock.now());
      const events = await combat.execute(1, { kind: "poll" });
      expect(events[0], `skip ${skip}`).toEqual({ type: "turn-timeout" });
      expect(events.some((event) => event.type === "finished")).toBe(false);
      clock.advanceMs(2500);
      await delay.fireDue(clock.now());
      await combat.execute(1, { kind: "poll" });
    }
    clock.advanceMs(20_000);
    await delay.fireDue(clock.now());
    const last = await combat.execute(1, { kind: "poll" });
    expect(last.map((event) => event.type)).toEqual(["turn-timeout", "damage", "finished"]);
    expect(last[1]).toMatchObject({ killed: true, animation: "", react: 10 });
    expect(last[2]).toMatchObject({ winnerTeam: 2 });
    expect(await combat.hasFight(start.fightId)).toBe(false);
  });

  it("does not count skips across a turn the hunter played", async () => {
    const clock = new MutableClock(START);
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([2, 2, 8, 2, 2]),
    });
    const start = await startHuntWithIssuedId(combat, unitHuntStart({ botHp: 500 }));
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    for (const round of [1, 2]) {
      clock.advanceMs(20_000);
      await delay.fireDue(clock.now());
      await combat.execute(1, { kind: "poll" });
      clock.advanceMs(2500);
      await delay.fireDue(clock.now());
      await combat.execute(1, { kind: "poll" });
      expect(await combat.hasFight(start.fightId), `after skip ${round}`).toBe(true);
    }
    await combat.execute(1, { kind: "strike", side: "left", sequence: 9 });
    await combat.execute(1, { kind: "poll" });
    clock.advanceMs(2500);
    await delay.fireDue(clock.now());
    await combat.execute(1, { kind: "poll" });
    clock.advanceMs(20_000);
    await delay.fireDue(clock.now());
    const events = await combat.execute(1, { kind: "poll" });
    expect(events.some((event) => event.type === "finished")).toBe(false);
    expect(await combat.hasFight(start.fightId)).toBe(true);
  });
});

describe("CombatService stun", () => {
  it("gives a stunned hunter's turns to the bot and grants him again once the stun is spent", async () => {
    const clock = new MutableClock(START);
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([8, 0.95, 1, 1]),
    });
    const stun = unitHuntSpellCard({
      artikulId: 6197,
      title: "Сокрушение",
      picture: "stun.png",
      maxCasts: 1,
      spell: {
        animData: "magic_aoe",
        endTurn: true,
        effects: [{ kind: 18, dmgType: 0, duration: 2 }],
      },
    });
    const start = await startHuntWithIssuedId(
      combat,
      unitHuntStart({
        botStrength: 15,
        botHp: 500,
        botSpellBook: { ...EMPTY_HUNT_BOT_SPELL_BOOK, nothingWeight: 100, spells: [stun] },
      }),
    );
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    await combat.execute(1, { kind: "poll" });

    const seen: string[][] = [];
    for (const waitMs of [1400, 1100, 1400, 1100, 1400, 1100]) {
      clock.advanceMs(waitMs);
      await delay.fireDue(clock.now());
      const events = await combat.execute(1, { kind: "poll" });
      seen.push(
        events.map((event) =>
          event.type === "damage" && event.sourceId === 1_000_000 ? "bot-hit" : event.type,
        ),
      );
    }
    expect(seen).toEqual([
      ["buff-cast"],
      [],
      ["bot-hit"],
      [],
      ["bot-hit"],
      [{ type: "turn-granted", timeoutSeconds: 20 }].map((event) => event.type),
    ]);
  });
});
