import type { RandomSource } from "../../../src/modules/combat/domain/random-source.ts";

export class SequenceRandom implements RandomSource {
  constructor(private readonly values: number[]) {
    if (values.length === 0) throw new Error("Random sequence must not be empty");
  }

  integer(minInclusive: number, maxInclusive: number): number {
    const value = this.values.shift();
    if (value === undefined) throw new Error("Random sequence is exhausted");
    if (value < minInclusive || value > maxInclusive) {
      throw new Error(`Random value ${value} is outside ${minInclusive}..${maxInclusive}`);
    }
    return value;
  }

  unit(): number {
    const value = this.values.shift();
    if (value === undefined) throw new Error("Random sequence is exhausted");
    if (value < 0 || value >= 1) {
      throw new Error(`Random unit ${value} is outside [0, 1)`);
    }
    return value;
  }
}
