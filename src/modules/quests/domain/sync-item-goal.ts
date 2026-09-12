import type { QuestDocument, QuestGoalDocument } from "../../content/domain/content-quest.ts";
import type { HeroQuestGoal } from "./hero-quest.ts";
import { currentGoal } from "./prior-gate.ts";
import { scriptEffects, type QuestScriptEffect } from "./quest-script-effect.ts";

export type ItemGoalRewrite = Readonly<{
  goal: HeroQuestGoal;
  onFinish: readonly QuestScriptEffect[];
}>;

export function itemGoalToSync(
  quest: QuestDocument,
  goals: readonly HeroQuestGoal[],
): QuestGoalDocument | null {
  const current = currentGoal(quest, goals);
  if (current && (current.kind === "loot" || current.kind === "deliver")) return current;
  if (current) return null;
  const ordered = [...quest.goals].sort((left, right) => left.goalOrd - right.goalOrd);
  const last = ordered[ordered.length - 1];
  if (!last || (last.kind !== "loot" && last.kind !== "deliver")) return null;
  return last;
}

export function bagCountForGoal(
  goal: QuestGoalDocument,
  counts: ReadonlyMap<number, number>,
): number {
  if (goal.artikuls.length === 0) {
    throw new Error(`Quest goal ${goal.id} loot/deliver artikul is required`);
  }
  let owned = 0;
  for (const item of goal.artikuls) {
    const count = counts.get(item.artikulId);
    if (count !== undefined && count > owned) owned = count;
  }
  return owned;
}

export function rewriteItemGoal(
  goals: readonly HeroQuestGoal[],
  goal: QuestGoalDocument,
  bagCount: number,
): ItemGoalRewrite | null {
  if (!Number.isInteger(bagCount) || bagCount < 0) {
    throw new Error("Bag count is required");
  }
  const row = goals.find((item) => item.goalId === goal.id);
  if (!row) throw new Error(`Hero quest goal ${goal.id} is missing`);
  const nextValue = Math.min(goal.limit, bagCount);
  const done: 0 | 1 = nextValue >= goal.limit ? 1 : 0;
  if (row.value === nextValue && row.done === done) return null;
  const newlyFinished = row.done === 0 && done === 1;
  return {
    goal: { ...row, value: nextValue, done },
    onFinish: newlyFinished ? scriptEffects(goal.onFinish) : [],
  };
}
