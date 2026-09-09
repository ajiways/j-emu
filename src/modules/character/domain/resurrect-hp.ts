export function resurrectHp(hpMax: number): number {
  if (!Number.isInteger(hpMax) || hpMax < 1) {
    throw new Error("Resurrect hpMax must be a positive integer");
  }
  return Math.max(2, Math.floor(hpMax * 0.05));
}
