import { describe, expect, it } from "vitest";
import type { CombatSpell } from "../../../src/modules/combat/domain/combat-loadout.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { FighterEffects } from "../../../src/modules/combat/domain/fighter-effects.ts";
import { UNPUBLISHED_MAG_STATS } from "../../../src/modules/combat/domain/mag-stats.ts";
import { rollOverlayExtra } from "../../../src/modules/combat/domain/melee-school-overlay.ts";
import { schoolOverlayFromKind1 } from "../../../src/modules/combat/domain/school-overlay.ts";
import { strikeModsOfOverlay } from "../../../src/modules/combat/domain/strike-mods.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { plainTarget } from "../../support/plain-damage-target.ts";
import { unitStatBase } from "../../support/stat-base.ts";

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

function chargedEffects(): FighterEffects {
  const effects = new FighterEffects({
    heroId: 1,
    base: unitStatBase(15),
    startedAtMs: 0,
    gearSpells: [],
    effectIds: new FightEffectIds(),
  });
  const overlay = schoolOverlayFromKind1(HISSA_397, 15);
  if (!overlay) throw new Error("Expected an overlay");
  effects.attachChargingKind3({
    strike: strikeModsOfOverlay(overlay),
    sourceId: 1,
    artikulId: 397,
    title: "Смертельное прикосновение",
    img: "hissa_magic1.png",
    dmgType: 64,
    remainTurns: 1,
    groupId: 845,
  });
  return effects;
}

describe("rollOverlayExtra", () => {
  it("applies school leftover after a physical miss (HP unchanged) and spends the charge", () => {
    const effects = chargedEffects();
    const roll = rollOverlayExtra(
      effects,
      UNPUBLISHED_MAG_STATS,
      plainTarget(UNPUBLISHED_MAG_STATS),
      27,
      new SequenceRandom([1]),
      UNIT_BATTLE_RULES,
    );
    expect(roll.extra).toEqual({ hpChange: -1, dmgType: 64, react: 2, killed: false });
    expect(roll.purges).toEqual([{ type: "effect-purge", effectId: 1 }]);
    expect(effects.snapshot()).toEqual([]);
  });

  it("skips the overlay and keeps the charge when the target is already dead", () => {
    const effects = chargedEffects();
    const roll = rollOverlayExtra(
      effects,
      UNPUBLISHED_MAG_STATS,
      plainTarget(UNPUBLISHED_MAG_STATS),
      0,
      new SequenceRandom([1]),
      UNIT_BATTLE_RULES,
    );
    expect(roll).toEqual({ extra: null, purges: [] });
    expect(effects.snapshot()).toHaveLength(1);
  });
});
