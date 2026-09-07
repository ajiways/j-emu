import type { RandomSource } from "./random-source.ts";

export class SystemRandomSource implements RandomSource {
  integer(minInclusive: number, maxInclusive: number): number {
    if (maxInclusive < minInclusive) throw new Error("Invalid random range");
    return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
  }
}
