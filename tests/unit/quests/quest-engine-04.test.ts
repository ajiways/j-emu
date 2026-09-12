import { describe, expect, it } from "vitest";
import { ambushHits } from "../../../src/modules/quests/domain/ambush-chance.ts";
import { hasQuestStartFight } from "../../../src/modules/quests/domain/quest-start-fight.ts";
import {
  bagCountForGoal,
  itemGoalToSync,
  rewriteItemGoal,
} from "../../../src/modules/quests/domain/sync-item-goal.ts";
import path from "node:path";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";
import type { HeroQuestGoal } from "../../../src/modules/quests/domain/hero-quest.ts";

const playable = loadContentBundleFile(path.resolve(process.cwd(), "content/playable-slice.json"));

describe("quest start fight variants", () => {
  it("parks AREA only for mode quest START_FIGHT", () => {
    const area = playable.quests.find((quest) => quest.key === "q_engine_area");
    const ambush = playable.quests.find((quest) => quest.key === "q_engine_ambush");
    if (!area || !ambush) throw new Error("engine area quests are required");
    expect(hasQuestStartFight(area.goals[0]?.onFinish ?? [])).toBe(true);
    expect(hasQuestStartFight(ambush.goals[0]?.onFinish ?? [])).toBe(false);
  });

  it("treats omitted ambush chance as always and misses when unit is not below chance", () => {
    expect(ambushHits({ type: "START_FIGHT", artikulId: 2 }, { unit: () => 0.99 })).toBe(true);
    expect(ambushHits({ type: "START_FIGHT", artikulId: 2, chance: 1 }, { unit: () => 1 })).toBe(
      false,
    );
    expect(ambushHits({ type: "START_FIGHT", artikulId: 2, chance: 1 }, { unit: () => 0 })).toBe(
      true,
    );
  });
});

describe("QL-2 bag rewrite", () => {
  it("sets loot done from bag count and can roll a completed last goal back", () => {
    const fight = playable.quests.find((quest) => quest.key === "q_engine_fight");
    if (!fight) throw new Error("q_engine_fight is required");
    const loot = fight.goals.find((goal) => goal.id === "loot_meat");
    if (!loot) throw new Error("loot_meat is required");
    const done: HeroQuestGoal = {
      heroId: 1,
      questKey: fight.key,
      goalId: loot.id,
      goalOrd: loot.goalOrd,
      done: 1,
      value: 1,
    };
    const others = fight.goals
      .filter((goal) => goal.id !== loot.id)
      .map((goal) => ({
        heroId: 1,
        questKey: fight.key,
        goalId: goal.id,
        goalOrd: goal.goalOrd,
        done: 1 as const,
        value: 1,
      }));
    const goals = [...others, done];
    expect(itemGoalToSync(fight, goals)?.id).toBe("loot_meat");
    expect(bagCountForGoal(loot, new Map())).toBe(0);
    const rewritten = rewriteItemGoal(goals, loot, 0);
    expect(rewritten?.goal).toMatchObject({ value: 0, done: 0 });
    expect(rewritten?.onFinish).toEqual([]);
  });
});
