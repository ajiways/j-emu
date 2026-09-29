import type { RandomSource } from "../../../src/modules/combat/domain/random-source.ts";

/**
 * Every integer roll is the range minimum and every unit roll is high, so nothing dodges,
 * blocks, or crits and damage stays at its floor.
 */
export class FixedRandom implements RandomSource {
  integer(minInclusive: number): number {
    return minInclusive;
  }

  unit(): number {
    return 0.99;
  }
}
