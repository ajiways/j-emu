import { appliedHpLoss } from "./applied-hp-loss.ts";
import type { Fighter } from "./fighter.ts";

export type HpLoss = Readonly<{ applied: number; killed: boolean }>;

/**
 * The one place a hit becomes lost hp: caps overkill at the target's hp, books the
 * dealer's credit, applies the loss and reports the kill. A hit on a fighter already
 * at 0 hp changes nothing.
 */
export function resolveHpLoss(target: Fighter, requested: number, dealer?: Fighter): HpLoss {
  const applied = appliedHpLoss(requested, target.hp);
  if (applied < 1) return { applied: 0, killed: target.hp === 0 };
  dealer?.creditDealt(applied, target);
  const killed = target.applyDamage(applied);
  if (killed && dealer) target.markKilledBy(dealer.id);
  return { applied, killed };
}
