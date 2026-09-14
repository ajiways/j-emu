import { describe, expect, it } from "vitest";
import { rollOverlayExtra } from "../../../src/modules/combat/domain/melee-school-overlay.ts";
import { schoolOverlayFromKind1 } from "../../../src/modules/combat/domain/school-overlay.ts";
import { UNPUBLISHED_MAG_STATS } from "../../../src/modules/combat/domain/mag-stats.ts";
import type { CombatSpell } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

const HISSA_397: CombatSpell = {
  animData: "magic_baf",
  effects: [
    {
      kind: 1,
      dmgType: 64,
      charging: 1,
      skills: [{ skillId: "pcSTR", value: -84 }],
    },
  ],
};

describe("rollOverlayExtra", () => {
  it("applies school leftover after a physical miss (HP unchanged)", () => {
    const owner = {
      schoolOverlay: schoolOverlayFromKind1(HISSA_397, 15),
    };
    const extra = rollOverlayExtra(
      owner,
      UNPUBLISHED_MAG_STATS,
      UNPUBLISHED_MAG_STATS,
      27,
      new SequenceRandom([1]),
      UNIT_BATTLE_RULES,
    );
    expect(extra).toEqual({
      hpChange: -1,
      dmgType: 64,
      react: 2,
      killed: false,
    });
    expect(owner.schoolOverlay).toBeNull();
  });

  it("skips overlay and keeps the charge when the target is already dead", () => {
    const overlay = schoolOverlayFromKind1(HISSA_397, 15);
    const owner = { schoolOverlay: overlay };
    expect(
      rollOverlayExtra(
        owner,
        UNPUBLISHED_MAG_STATS,
        UNPUBLISHED_MAG_STATS,
        0,
        new SequenceRandom([1]),
        UNIT_BATTLE_RULES,
      ),
    ).toBeNull();
    expect(owner.schoolOverlay).toBe(overlay);
  });
});
