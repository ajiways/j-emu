import type { RandomSource } from "./random-source.ts";

/**
 * Softening constant of the first-strike odds. Legacy behavior from jgr `damage.ts`; the live
 * formula is not known.
 */
const INITIATIVE_SOFT_C = 80;

/**
 * Whether A strikes first: the odds are `(A + C) / (A + B + 2C)`, so the one with the bigger
 * initiative is first more often but never always, and even zero has a chance against a stronger
 * one. `true` when the roll lands under the odds of A.
 */
export function rollOpensFirst(iniA: number, iniB: number, random: RandomSource): boolean {
  if (!Number.isInteger(iniA) || iniA < 0) {
    throw new Error("Initiative A must be a non-negative integer");
  }
  if (!Number.isInteger(iniB) || iniB < 0) {
    throw new Error("Initiative B must be a non-negative integer");
  }
  return random.unit() < (iniA + INITIATIVE_SOFT_C) / (iniA + iniB + 2 * INITIATIVE_SOFT_C);
}
