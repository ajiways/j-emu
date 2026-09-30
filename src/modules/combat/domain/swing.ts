import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { FighterEffects } from "./fighter-effects.ts";
import { rollMeleeDamage } from "./melee-damage.ts";
import type { RandomSource } from "./random-source.ts";

export type Swing = Readonly<{
  baseDamage: number;
  forceCrit: boolean;
  critChance: number;
  /** `effPurge` of the charged effects this swing spent the last charge of. */
  purges: readonly BattleEvent[];
}>;

/**
 * One physical swing of a fighter: spends a charge of every swing-changing charged effect on him
 * (orbs, rage, glove buffs), then rolls the damage with their flat strength and percent added.
 */
export function rollSwing(
  effects: FighterEffects,
  strength: number,
  random: RandomSource,
  rules: BattleRules,
): Swing {
  const spent = effects.takeStrike();
  let baseDamage = rollMeleeDamage(strength + spent.strFlat, random, rules);
  for (const pcStr of spent.pcStrs) {
    baseDamage = Math.max(1, Math.round(baseDamage * (1 + pcStr / 100)));
  }
  return {
    baseDamage,
    forceCrit: spent.critChance >= 1,
    critChance: spent.critChance < 1 ? spent.critChance : 0,
    purges: spent.purged.map((effectId) => ({ type: "effect-purge" as const, effectId })),
  };
}
