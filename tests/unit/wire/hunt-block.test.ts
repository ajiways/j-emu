import { describe, expect, it } from "vitest";
import {
  buildHuntBlock,
  IDLE_HUNT_FIGHT_ID,
} from "../../../src/modules/jugger-wire/application/hunt-block.ts";
import { HuntSpawn } from "../../../src/modules/world/domain/hunt-spawn.ts";

describe("buildHuntBlock", () => {
  it("emits an array of live hunt wire bots", () => {
    const spawn = new HuntSpawn(50310, 2, 883, 1499, "bot_1");
    expect(buildHuntBlock([spawn])).toEqual({
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
