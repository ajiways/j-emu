import { describe, expect, it } from "vitest";
import { rollOpensFirst } from "../../../src/modules/combat/domain/roll-opens-first.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

describe("rollOpensFirst", () => {
  it("flips a fair coin when both initiatives are unpublished zeros", () => {
    expect(rollOpensFirst(0, 0, new SequenceRandom([0.4]))).toBe(true);
    expect(rollOpensFirst(0, 0, new SequenceRandom([0.5]))).toBe(false);
  });

  it("gives even a zero initiative a chance against a stronger one, and the stronger one more", () => {
    // 0 against 100: (0 + 80) / (100 + 160) is about 31 %; the other way round about 69 %.
    expect(rollOpensFirst(0, 100, new SequenceRandom([0.3]))).toBe(true);
    expect(rollOpensFirst(0, 100, new SequenceRandom([0.35]))).toBe(false);
    expect(rollOpensFirst(100, 0, new SequenceRandom([0.65]))).toBe(true);
    expect(rollOpensFirst(100, 0, new SequenceRandom([0.7]))).toBe(false);
  });
});
