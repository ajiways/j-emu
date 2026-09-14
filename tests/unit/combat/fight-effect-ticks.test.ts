import { describe, expect, it } from "vitest";
import { HuntHumanFightEffects } from "../../../src/modules/combat/domain/hunt-human-fight-effects.ts";

describe("HuntHumanFightEffects ticks", () => {
  it("budgets duration/period pulses and drops the effect on the last tick", () => {
    const effects = new HuntHumanFightEffects({
      heroId: 1,
      strength: 10,
      startedAtMs: 0,
      gearSpells: [],
    });
    effects.attachTick({
      kind: 4,
      sourceId: 1_000_000,
      artikulId: 396,
      title: "396",
      img: "",
      dmgType: 64,
      duration: 81,
      period: 20,
      catalogPcStr: -50,
      catalogStr: 0,
      casterStrength: 15,
      casterMagPower: 0,
      casterMagResist: 0,
    });
    expect(effects.snapshot()).toHaveLength(1);
    const first = effects.takeTickPulses();
    expect(first).toEqual([
      {
        effectId: 1,
        kind: 4,
        sourceId: 1_000_000,
        dmgType: 64,
        catalogPcStr: -50,
        catalogStr: 0,
        casterStrength: 15,
        casterMagPower: 0,
        casterMagResist: 0,
        last: false,
      },
    ]);
    effects.takeTickPulses();
    effects.takeTickPulses();
    const last = effects.takeTickPulses();
    expect(last[0]?.last).toBe(true);
    expect(effects.snapshot()).toHaveLength(0);
  });
});
