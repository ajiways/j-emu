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
