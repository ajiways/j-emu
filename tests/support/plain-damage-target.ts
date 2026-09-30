import type { DamageTarget } from "../../src/modules/combat/domain/damage-target.ts";
import type { MagStats } from "../../src/modules/combat/domain/mag-stats.ts";

/** A hit's target with nothing standing on it: the hit lands as rolled. */
export function plainTarget(mag: MagStats): DamageTarget {
  return { mag, effects: { takenDamage: (raw) => raw } };
}
