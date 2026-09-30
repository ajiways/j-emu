import type { DamageTarget } from "../../src/modules/combat/domain/damage-target.ts";
import type { MagCaster } from "../../src/modules/combat/domain/magic-hit.ts";
import type { MagStats } from "../../src/modules/combat/domain/mag-stats.ts";

/** A hit's target with nothing standing on it: the hit lands as rolled. */
export function plainTarget(mag: MagStats): DamageTarget {
  return { mag, effects: { takenDamage: (raw) => raw } };
}

/** A caster with nothing standing on him, or with the given skills standing. */
export function plainCaster(
  mag: MagStats,
  skills: Readonly<Record<string, number>> = {},
): MagCaster {
  return { mag, effects: { standingSkill: (skillId) => skills[skillId] ?? 0 } };
}
