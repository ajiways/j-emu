import { describe, expect, it } from "vitest";
import {
  buildHuntBlock,
  IDLE_HUNT_FIGHT_ID,
} from "../../../src/modules/jugger-wire/application/hunt-block.ts";

describe("buildHuntBlock", () => {
  it("emits an array of live hunt wire bots", () => {
    expect(
      buildHuntBlock([
        {
          id: 50310,
          artikulId: 2,
          fightId: IDLE_HUNT_FIGHT_ID,
          huntMask: "bot_1",
          positionX: 883,
          positionY: 1499,
          prevX: 883,
          prevY: 1499,
        },
      ]),
    ).toEqual({
      status: 100,
      bots: [
        {
          id: 50310,
          artikul_id: 2,
          fight_id: IDLE_HUNT_FIGHT_ID,
          hunt_mask: "bot_1",
          position_x: 883,
          position_y: 1499,
          prev_x: 883,
          prev_y: 1499,
        },
      ],
    });
  });
});
