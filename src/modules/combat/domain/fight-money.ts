export function goldToMinor(gold: number): number {
  if (!Number.isFinite(gold) || gold < 0) throw new Error("Gold amount is invalid");
  return Math.round(gold * 100);
}

export function rollMoneyGold(min: number, max: number, random: { unit(): number }): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) {
    throw new Error("Money range is invalid");
  }
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + random.unit() * (hi - lo);
}

export function goldWireString(minorUnits: number): string {
  if (!Number.isInteger(minorUnits) || minorUnits < 0) {
    throw new Error("Money minor units are invalid");
  }
  if (minorUnits === 0) return "0";
  return String(minorUnits / 100);
}
