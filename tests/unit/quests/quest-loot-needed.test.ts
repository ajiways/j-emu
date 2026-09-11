import { describe, expect, it } from "vitest";
import path from "node:path";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";
import {
  capDropQuantity,
  neededLoot,
} from "../../../src/modules/quests/domain/quest-loot-needed.ts";
import type { HeroQuestGoal } from "../../../src/modules/quests/domain/hero-quest.ts";

const playable = loadContentBundleFile(path.resolve(process.cwd(), "content/playable-slice.json"));

describe("quest loot needed", () => {
  const fight = playable.quests.find((row) => row.key === "q_engine_fight");
  if (!fight) throw new Error("playable slice is missing q_engine_fight");

  it("returns null when the current goal is not loot/deliver", () => {
    const goals = fight.goals.map((goal) => goalRow(fight.key, goal.id, goal.goalOrd, 0, 0));
    expect(neededLoot([{ quest: fight, goals }], 77, 0)).toBeNull();
  });

  it("caps to the current loot goal remainder, not a global artikul floor", () => {
    const goals = fight.goals.map((goal) =>
      goal.id === "loot_meat"
        ? goalRow(fight.key, goal.id, goal.goalOrd, 0, 0)
        : goalRow(fight.key, goal.id, goal.goalOrd, 1, 1),
    );
    expect(neededLoot([{ quest: fight, goals }], 77, 0)).toBe(1);
    expect(neededLoot([{ quest: fight, goals }], 77, 1)).toBe(0);
    expect(capDropQuantity(2, 1)).toBe(1);
    expect(capDropQuantity(2, null)).toBe(2);
  });
});

function goalRow(
  questKey: string,
  goalId: string,
  goalOrd: number,
  done: 0 | 1,
  value: number,
): HeroQuestGoal {
  return { heroId: 1, questKey, goalId, goalOrd, done, value };
}
