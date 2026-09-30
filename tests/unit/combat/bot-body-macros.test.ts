import { describe, expect, it } from "vitest";
import { resolveBotBody } from "../../../src/modules/combat/domain/bot-body-macros.ts";
import { FixedRandom } from "../../support/fakes/fixed-random.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

describe("resolveBotBody", () => {
  it("settles ranges and part lists in the order they appear", () => {
    const body =
      "armor(rand[2#2049,107#2049,106#2049],100#4098);head(rand[1-10],rand[151-161]);skin(rand[101-107])";
    expect(resolveBotBody(body, new SequenceRandom([1, 7, 155, 103]))).toBe(
      "armor(107#2049,100#4098);head(7,155);skin(103)",
    );
  });

  it("leaves a body without macros alone", () => {
    expect(resolveBotBody("armor();head(0,0,8,152);skin()", new FixedRandom())).toBe(
      "armor();head(0,0,8,152);skin()",
    );
  });

  it("fails on a reversed range and an empty option", () => {
    expect(() => resolveBotBody("head(rand[10-1])", new SequenceRandom([5]))).toThrow(/reversed/);
    expect(() => resolveBotBody("armor(rand[1#2,,3#4])", new SequenceRandom([0]))).toThrow(
      /malformed/,
    );
  });
});
