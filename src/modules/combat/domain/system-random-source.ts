import { randomInt } from "node:crypto";
import type { RandomSource } from "./random-source.ts";

export class SystemRandomSource implements RandomSource {
  integer(minInclusive: number, maxInclusive: number): number {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
      throw new Error("Random integer bounds must be integers");
    }
    if (maxInclusive < minInclusive) throw new Error("Invalid random range");
    return randomInt(minInclusive, maxInclusive + 1);
  }

  unit(): number {
    return randomInt(0, 1_000_000_000) / 1_000_000_000;
  }
}
