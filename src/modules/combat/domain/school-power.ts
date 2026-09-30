import type { FighterEffects } from "./fighter-effects.ts";
import type { MagStats } from "./mag-stats.ts";

/** Spell `dmgType` of a school → the flat power skill of that school (ADR-0021, ../server FIGHT_MAGIC). */
const SCHOOL_POWER_SKILL: Readonly<Record<number, string>> = {
  4: "MAGSTR_DRK",
  8: "MAGSTR_LTN",
  16: "MAGSTR_ICE",
  32: "MAGSTR_FR",
  64: "MAGSTR_ACD",
  128: "MAGSTR_LGH",
};

const NOT_A_SCHOOL: ReadonlySet<number> = new Set([0, 1, 256]);

/** What the effects standing on a caster add to his magic power of the school `dmgType`. */
function schoolPowerBonus(effects: Pick<FighterEffects, "standingSkill">, dmgType: number): number {
  if (NOT_A_SCHOOL.has(dmgType)) return 0;
  const skillId = SCHOOL_POWER_SKILL[dmgType];
  if (skillId === undefined) throw new Error(`Damage type ${dmgType} is not a known school`);
  return effects.standingSkill(skillId);
}

/** The caster's magic stats for one hit of `dmgType`, school power from his effects included. */
export function casterMagFor(
  caster: Readonly<{ mag: MagStats; effects: Pick<FighterEffects, "standingSkill"> }>,
  dmgType: number,
): MagStats {
  return {
    power: Math.max(0, caster.mag.power + schoolPowerBonus(caster.effects, dmgType)),
    resist: caster.mag.resist,
  };
}
