/** The standing effect of the «Ярость» button: the next weapon swing carries it. */
export const RAGE_EFFECT_ARTIKUL_ID = 212;

/** Next-hit STR% from rage fill. Official anchors: 50% → +18%, 100% → +50%. */
export function rageBonusPctFromFill(fill: number): number {
  if (typeof fill !== "number" || Number.isNaN(fill) || fill < 0) {
    throw new Error("Rage fill must be a non-negative number");
  }
  const f = Math.min(100, fill);
  if (f <= 0) return 0;
  const raw = f <= 50 ? (18 / 50) * f : 18 + ((50 - 18) / 50) * (f - 50);
  return Math.round(raw * 10) / 10;
}

/** The rage fill (0–100) that gave a next-hit bonus of `pct` percent: the inverse of the curve above. */
export function rageFillFromBonusPct(pct: number): number {
  if (typeof pct !== "number" || Number.isNaN(pct) || pct < 0) {
    throw new Error("Rage bonus must be a non-negative number");
  }
  const bonus = Math.min(50, pct);
  return bonus <= 18 ? (bonus * 50) / 18 : 50 + ((bonus - 18) * 50) / 32;
}
