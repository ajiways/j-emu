import type { BattleRules } from "./battle-rules.ts";
import type { RandomSource } from "./random-source.ts";

export type MeleeDamageBounds = Readonly<{ min: number; max: number }>;

export function meleeDamageBounds(strength: number, rules: BattleRules): MeleeDamageBounds {
  requireStrength(strength);
  requireFormula(rules);
  const mean = strength / rules.strPerDamagePoint;
  const min = Math.max(1, Math.round(mean * (1 - rules.damageSpread)));
  const max = Math.max(min, Math.round(mean * (1 + rules.damageSpread)));
  return { min, max };
}

export function rollMeleeDamage(
  strength: number,
  random: RandomSource,
  rules: BattleRules,
): number {
  const bounds = meleeDamageBounds(strength, rules);
  return random.integer(bounds.min, bounds.max);
}

function requireStrength(strength: number): void {
  if (!Number.isInteger(strength) || strength < 1) {
    throw new Error("Melee strength must be a positive integer");
  }
}

function requireFormula(rules: BattleRules): void {
  if (!Number.isInteger(rules.strPerDamagePoint) || rules.strPerDamagePoint < 1) {
    throw new Error("strPerDamagePoint must be a positive integer");
  }
  if (
    typeof rules.damageSpread !== "number" ||
    Number.isNaN(rules.damageSpread) ||
    rules.damageSpread <= 0 ||
    rules.damageSpread >= 1
  ) {
    throw new Error("damageSpread must be in (0, 1)");
  }
}
