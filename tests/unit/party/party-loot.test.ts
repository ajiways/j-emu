import { describe, expect, it } from "vitest";
import { splitMinorUnits } from "../../../src/modules/combat/domain/split-minor-units.ts";
import { lotteryRound } from "../../../src/modules/party/domain/party-lottery.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

describe("splitMinorUnits", () => {
  it("spreads remainder cents to the first fighters", () => {
    expect(splitMinorUnits(20, 2)).toEqual([10, 10]);
    expect(splitMinorUnits(21, 2)).toEqual([11, 10]);
    expect(splitMinorUnits(5, 3)).toEqual([2, 2, 1]);
  });
});

describe("lotteryRound", () => {
  it("returns the unique max roll as winner and a tie when two share the max", () => {
    const win = lotteryRound([1, 2, 3], new SequenceRandom([12, 80, 40]));
    expect(win).toEqual({
      kind: "win",
      winnerId: 2,
      rolls: [
        { heroId: 1, roll: 12 },
        { heroId: 2, roll: 80 },
        { heroId: 3, roll: 40 },
      ],
    });
    const tie = lotteryRound([1, 2, 3], new SequenceRandom([12, 80, 80]));
    expect(tie.kind).toBe("tie");
    if (tie.kind !== "tie") throw new Error("expected tie");
    expect(tie.tied).toEqual([2, 3]);
  });
});
