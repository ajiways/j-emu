import { describe, expect, it } from "vitest";
import { advanceDuelClock } from "../../../src/modules/combat/domain/duel-clock.ts";
import { FixedRandom } from "../../support/fakes/fixed-random.ts";
import { unitBotSeed, unitFightBots } from "../../support/fight-bots.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";

function bots() {
  const [caster, victim] = unitFightBots({ allies: [unitBotSeed(1_000_001)], occupiedIds: [1] });
  if (!caster || !victim) throw new Error("Expected two bots");
  victim.effects.attachTick({
    kind: 4,
    sourceId: caster.id,
    artikulId: 396,
    title: "Ядовитый плевок",
    img: "hissa_magic1.png",
    dmgType: 64,
    durationSeconds: 80,
    periodSeconds: 20,
    nowMs: 0,
    castEndsTurn: false,
    catalogPcStr: 0,
    catalogStr: 5,
    casterStrength: 15,
    casterMagPower: 0,
    casterMagResist: 0,
  });
  return { caster, victim };
}

describe("DoT tick credit", () => {
  it("counts the tick damage as dealt by the caster", () => {
    const { caster, victim } = bots();
    const events = advanceDuelClock({
      fighters: [victim],
      nowMs: 0,
      jumpSeconds: 20,
      random: new FixedRandom(),
      rules: UNIT_BATTLE_RULES,
      sources: [caster, victim],
    });
    const tick = events.find((event) => event.type === "damage");
    if (tick?.type !== "damage") throw new Error("Expected a tick");
    expect(caster.dealtDamage).toBe(-tick.hpChange);
    expect(caster.dealtDamage).toBeGreaterThan(0);
  });

  it("fails when the caster is not in the roster", () => {
    const { victim } = bots();
    expect(() =>
      advanceDuelClock({
        fighters: [victim],
        nowMs: 0,
        jumpSeconds: 20,
        random: new FixedRandom(),
        rules: UNIT_BATTLE_RULES,
        sources: [victim],
      }),
    ).toThrow(/not in the fight roster/);
  });
});
