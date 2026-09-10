import { describe, expect, it } from "vitest";
import {
  PAIR_HITS_TO_SWITCH,
  planHuntShuffle,
} from "../../../src/modules/combat/domain/try-shuffle-after-hits.ts";

describe("planHuntShuffle", () => {
  it("hands the bot to a waiter at 3↔3 and resets when nobody waits", () => {
    expect(PAIR_HITS_TO_SWITCH).toBe(3);
    expect(
      planHuntShuffle({ humanHits: 3, botHits: 3, hasLivingWaiter: true, finished: false }),
    ).toBe("waiter-handoff");
    expect(
      planHuntShuffle({ humanHits: 3, botHits: 3, hasLivingWaiter: false, finished: false }),
    ).toBe("reset");
    expect(
      planHuntShuffle({ humanHits: 2, botHits: 3, hasLivingWaiter: true, finished: false }),
    ).toBe("none");
    expect(
      planHuntShuffle({ humanHits: 3, botHits: 3, hasLivingWaiter: true, finished: true }),
    ).toBe("none");
  });
});
