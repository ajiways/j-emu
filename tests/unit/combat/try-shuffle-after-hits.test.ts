import { describe, expect, it } from "vitest";
import {
  PAIR_HITS_TO_SWITCH,
  planHuntShuffle,
} from "../../../src/modules/combat/domain/try-shuffle-after-hits.ts";

describe("planHuntShuffle", () => {
  it("rotates at 3↔3 when a waiter, other 3↔3 pair, or reserve exists", () => {
    expect(PAIR_HITS_TO_SWITCH).toBe(3);
    expect(
      planHuntShuffle({
        humanHits: 3,
        botHits: 3,
        hasLivingWaiter: true,
        hasSwappableOther: false,
        hasLivingReserve: false,
        finished: false,
      }),
    ).toBe("waiter-handoff");
    expect(
      planHuntShuffle({
        humanHits: 3,
        botHits: 3,
        hasLivingWaiter: false,
        hasSwappableOther: false,
        hasLivingReserve: false,
        finished: false,
      }),
    ).toBe("none");
    expect(
      planHuntShuffle({
        humanHits: 3,
        botHits: 3,
        hasLivingWaiter: false,
        hasSwappableOther: true,
        hasLivingReserve: false,
        finished: false,
      }),
    ).toBe("cross-swap");
    expect(
      planHuntShuffle({
        humanHits: 3,
        botHits: 3,
        hasLivingWaiter: false,
        hasSwappableOther: false,
        hasLivingReserve: true,
        finished: false,
      }),
    ).toBe("reserve-swap");
    expect(
      planHuntShuffle({
        humanHits: 2,
        botHits: 3,
        hasLivingWaiter: true,
        hasSwappableOther: false,
        hasLivingReserve: false,
        finished: false,
      }),
    ).toBe("none");
    expect(
      planHuntShuffle({
        humanHits: 3,
        botHits: 3,
        hasLivingWaiter: true,
        hasSwappableOther: false,
        hasLivingReserve: false,
        finished: true,
      }),
    ).toBe("none");
  });
});
