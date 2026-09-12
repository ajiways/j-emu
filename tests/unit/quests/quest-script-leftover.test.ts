import { describe, expect, it } from "vitest";
import {
  leftoverJumpArea,
  leftoverQuestEffects,
} from "../../../src/modules/quests/domain/quest-script-leftover.ts";

describe("quest script leftover", () => {
  it("keeps JUMP_AREA next to START_FIGHT and does not treat GRANT as leftover", () => {
    const effects = leftoverQuestEffects([
      { type: "JUMP_AREA" },
      { type: "GRANT_ARTIKUL", artikulId: 23, count: 1 },
      {
        type: "START_FIGHT",
        mode: "quest",
        enemies: [{ artikulId: 2, count: 1 }],
        allies: [],
        chatStart: "",
        chatWin: "",
        chatLose: "",
      },
    ]);
    expect(effects.map((effect) => effect.type)).toEqual(["JUMP_AREA", "START_FIGHT"]);
    expect(leftoverJumpArea(effects)).toEqual({ type: "JUMP_AREA" });
  });
});
