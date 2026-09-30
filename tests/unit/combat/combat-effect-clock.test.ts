import { describe, expect, it } from "vitest";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { createCombatService } from "../../support/create-combat-service.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { unitHissaSpitBook, unitHuntStart } from "../../support/hunt-start-input.ts";

describe("CombatService effect clock", () => {
  it("ticks a paired carrier on the battle timer without any strike", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([8, 0.95, 1, 1]),
    });
    const start = await startHuntWithIssuedId(
      combat,
      unitHuntStart({
        botId: 4,
        botNick: "Хисса",
        botStrength: 15,
        botSpellBook: unitHissaSpitBook({ duration: 80, period: 20 }),
      }),
    );
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    await combat.execute(1, { kind: "strike", side: "left", sequence: 2 });
    await combat.execute(1, { kind: "poll" });
    clock.advanceMs(1400);
    await delay.fireDue(clock.now());
    const cast = await combat.execute(1, { kind: "poll" });
    expect(cast.some((event) => event.type === "effect-use")).toBe(true);
    clock.advanceMs(19_000);
    await delay.fireDue(clock.now());
    expect(await combat.execute(1, { kind: "poll" }).then(typesOf)).not.toContain("pers-change");
    clock.advanceMs(1000);
    await delay.fireDue(clock.now());
    const tick = await combat.execute(1, { kind: "poll" });
    expect(tick.map((event) => event.type)).toEqual(
      expect.arrayContaining(["pers-change", "damage"]),
    );
    expect(tick.find((event) => event.type === "damage")).toMatchObject({
      animation: "",
      targetId: 1,
      hpChange: -1,
      dmgType: 64,
    });
  });
  it("ticks Hissa 396 (81/40) on the bot's second and fourth actions, then lets it lapse", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const { combat, delay } = createCombatService({
      clock,
      random: new SequenceRandom([8, 0.95, 1, 8, 0.1, 1, 1, 8, 0.1, 1, 1]),
    });
    const start = await startHuntWithIssuedId(
      combat,
      unitHuntStart({
        botId: 4,
        botNick: "Хисса",
        botStrength: 15,
        botSpellBook: unitHissaSpitBook(),
        botHp: 500,
        heroHp: 500,
        heroMaxHp: 500,
      }),
    );
    await combat.execute(1, { kind: "authenticate", fightId: start.fightId, sequence: 1 });
    await combat.execute(1, { kind: "poll" });
    const rounds: { strike: string[]; counter: string[] }[] = [];
    for (let round = 0; round < 3; round += 1) {
      await combat.execute(1, { kind: "strike", side: "left", sequence: 10 + round });
      const strike = await combat.execute(1, { kind: "poll" });
      clock.advanceMs(1400);
      await delay.fireDue(clock.now());
      const counter = await combat.execute(1, { kind: "poll" });
      clock.advanceMs(1100);
      await delay.fireDue(clock.now());
      await combat.execute(1, { kind: "poll" });
      rounds.push({ strike: labels(strike), counter: labels(counter) });
    }
    expect(rounds).toEqual([
      {
        strike: ["turn-wait", "damage", "pers-change", "command-accepted"],
        counter: ["effect-use", "damage", "pers-change"],
      },
      {
        strike: ["turn-wait", "damage", "pers-change", "command-accepted"],
        counter: ["damage", "damage:tick", "pers-change"],
      },
      {
        strike: ["turn-wait", "damage", "pers-change", "command-accepted"],
        counter: ["damage", "damage:tick", "effect-purge", "pers-change"],
      },
    ]);
  });
});

function typesOf(events: readonly { type: string }[]): string[] {
  return events.map((event) => event.type);
}

function labels(events: readonly { type: string; animation?: string }[]): string[] {
  return events.map((event) =>
    event.type === "damage" && event.animation === "" ? "damage:tick" : event.type,
  );
}
