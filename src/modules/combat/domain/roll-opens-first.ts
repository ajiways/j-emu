import type { RandomSource } from "./random-source.ts";

/** Softening constant for first-strike odds. Legacy behavior from jgr `damage.ts`. */
const INITIATIVE_SOFT_C = 80;

export function rollOpensFirst(iniA: number, iniB: number, random: RandomSource): boolean {
  if (!Number.isInteger(iniA) || iniA < 0) {
    throw new Error("Initiative A must be a non-negative integer");
  }
  if (!Number.isInteger(iniB) || iniB < 0) {
    throw new Error("Initiative B must be a non-negative integer");
  }
  if (iniA + iniB <= 0) return random.unit() < 0.5;
  const wa = iniA / (iniA + INITIATIVE_SOFT_C);
  const wb = iniB / (iniB + INITIATIVE_SOFT_C);
  return random.unit() < wa / (wa + wb);
}
