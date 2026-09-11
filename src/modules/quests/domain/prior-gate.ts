import type { QuestDocument, QuestGoalDocument } from "../../content/domain/content-quest.ts";
import type { HeroQuestGoal } from "./hero-quest.ts";

export function currentGoal(
  quest: QuestDocument,
  goals: readonly HeroQuestGoal[],
): QuestGoalDocument | null {
  if (quest.goals.length === 0) return null;
  const byId = new Map(goals.map((row) => [row.goalId, row]));
  const ordered = [...quest.goals].sort((left, right) => left.goalOrd - right.goalOrd);
  for (const goal of ordered) {
    const row = byId.get(goal.id);
    if (!row || row.done !== 1) return goal;
  }
  return null;
}

export function goalsComplete(quest: QuestDocument, goals: readonly HeroQuestGoal[]): boolean {
  if (quest.goals.length === 0) return true;
  return currentGoal(quest, goals) === null;
}
