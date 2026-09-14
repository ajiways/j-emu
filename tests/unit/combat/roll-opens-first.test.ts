import { describe, expect, it } from "vitest";
import { rollOpensFirst } from "../../../src/modules/combat/domain/roll-opens-first.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

describe("rollOpensFirst", () => {
  it("flips a fair coin when both initiatives are unpublished zeros", () => {
    expect(rollOpensFirst(0, 0, new SequenceRandom([0.4]))).toBe(true);
    expect(rollOpensFirst(0, 0, new SequenceRandom([0.5]))).toBe(false);
  });
});
