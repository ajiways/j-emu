const DEATH_BREAK_MIN = 4;
const DEATH_BREAK_MAX = 5;
const REPAIR_COST_CAP_GOLD = 50;

const ARTIFACT_FLAG_NON_BREAK = 1;
const COLLECTS_EPICNESS = 536_870_912;

export type InstanceDurability = Readonly<{
  current: number;
  max: number;
  infinite: boolean;
}>;

function isInfiniteDurability(flags: number): boolean {
  if (!Number.isInteger(flags) || flags < 0) throw new Error("Artifact flags are invalid");
  return (flags & COLLECTS_EPICNESS) !== 0 && (flags & ARTIFACT_FLAG_NON_BREAK) !== 0;
}

export function instanceDurability(
  current: number,
  max: number,
  flags: number,
): InstanceDurability {
  if (!Number.isInteger(current) || current < 0) throw new Error("Durability is invalid");
  if (!Number.isInteger(max) || max < 0) throw new Error("Durability max is invalid");
  if (current > max) throw new Error("Durability exceeds durability max");
  return { current, max, infinite: isInfiniteDurability(flags) };
}

export function tracksDurability(d: InstanceDurability): boolean {
  return d.infinite || d.max > 0;
}

export function isBroken(d: InstanceDurability): boolean {
  return tracksDurability(d) && d.current <= 0;
}

export function canRepair(d: InstanceDurability): boolean {
  return tracksDurability(d) && d.current < d.max;
}

export type BreakResult = Readonly<{
  current: number;
  max: number;
  destroy: boolean;
}>;

export function applyBreak(current: number, max: number, infinite: boolean): BreakResult {
  if (!infinite && current <= 1 && max <= 1) {
    return { current: 0, max, destroy: true };
  }
  return { current: Math.max(0, current - 1), max, destroy: false };
}

export function applyRepair(
  current: number,
  max: number,
  infinite: boolean,
): Readonly<{ current: number; max: number }> {
  if (infinite) return { current: max, max };
  const next = Math.max(0, max - 1);
  return { current: next, max: next };
}

export function repairCostGold(priceGold: number): number {
  if (!Number.isFinite(priceGold) || priceGold < 0) throw new Error("Catalog price is invalid");
  const rounded = Math.round(priceGold * 0.02 * 100) / 100;
  return Math.min(REPAIR_COST_CAP_GOLD, rounded);
}

export function pickDeathBreaks<T>(pool: readonly T[], random: Readonly<{ unit(): number }>): T[] {
  if (pool.length === 0) return [];
  const hi = Math.min(DEATH_BREAK_MAX, pool.length);
  const lo = Math.min(DEATH_BREAK_MIN, hi);
  const n = lo + Math.floor(requireUnit(random.unit()) * (hi - lo + 1));
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(requireUnit(random.unit()) * (i + 1));
    const tmp = copy[i];
    const swap = copy[j];
    if (tmp === undefined || swap === undefined) throw new Error("Death-break shuffle is invalid");
    copy[i] = swap;
    copy[j] = tmp;
  }
  return copy.slice(0, n);
}

function requireUnit(unit: number): number {
  if (!Number.isFinite(unit) || unit < 0 || unit >= 1) {
    throw new Error("Death-break unit random must be in [0, 1)");
  }
  return unit;
}
