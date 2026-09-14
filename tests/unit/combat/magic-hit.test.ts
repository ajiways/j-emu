import { describe, expect, it } from "vitest";
import { rollMagicHit } from "../../../src/modules/combat/domain/magic-hit.ts";
import { UNPUBLISHED_MAG_STATS } from "../../../src/modules/combat/domain/mag-stats.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

describe("rollMagicHit", () => {
  it("keeps Hissa pcSTR −50 as STR/10 when MAGRES is unpublished 0", () => {
    expect(
      rollMagicHit({
        caster: UNPUBLISHED_MAG_STATS,
        target: UNPUBLISHED_MAG_STATS,
        casterStrength: 15,
        dmgType: 64,
        catalogPcStr: -50,
        random: new SequenceRandom([1]),
        rules: UNIT_BATTLE_RULES,
      }),
    ).toBe(1);
  });

  it("applies MAGRES soft-C 200 as half leftover at resist 200", () => {
    expect(
      rollMagicHit({
        caster: UNPUBLISHED_MAG_STATS,
        target: { power: 0, resist: 200 },
        casterStrength: 80,
        dmgType: 64,
        random: new SequenceRandom([8]),
        rules: UNIT_BATTLE_RULES,
      }),
    ).toBe(4);
  });

  it("does not add MAGSTR on physical dmgType 1", () => {
    expect(
      rollMagicHit({
        caster: { power: 40, resist: 0 },
        target: UNPUBLISHED_MAG_STATS,
        casterStrength: 80,
        dmgType: 1,
        random: new SequenceRandom([8]),
        rules: UNIT_BATTLE_RULES,
      }),
    ).toBe(8);
  });
});
