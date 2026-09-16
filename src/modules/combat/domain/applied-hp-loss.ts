/** HP actually lost. Wire `hpChange` uses this, never raw overkill past current HP. */
export function appliedHpLoss(raw: number, targetHp: number): number {
  if (!Number.isInteger(raw) || raw < 0) {
    throw new Error("Hit raw must be a non-negative integer");
  }
  if (!Number.isInteger(targetHp) || targetHp < 0) {
    throw new Error("Target hp must be a non-negative integer");
  }
  return Math.min(raw, targetHp);
}
