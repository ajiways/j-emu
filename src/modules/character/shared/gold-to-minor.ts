export function goldToMinor(gold: number): number {
  if (!Number.isFinite(gold) || gold < 0) throw new Error("Gold amount is invalid");
  return Math.round(gold * 100);
}
