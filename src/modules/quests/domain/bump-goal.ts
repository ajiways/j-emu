import type { QuestDocument, QuestGoalDocument } from "../../content/domain/content-quest.ts";
import type { HeroQuestGoal } from "../domain/hero-quest.ts";
import { currentGoal } from "../domain/prior-gate.ts";
import { scriptEffects, type QuestScriptEffect } from "../domain/quest-script-effect.ts";
import type { QuestSignal } from "../domain/quest-signal.ts";

export type GoalBump = Readonly<{
  goal: HeroQuestGoal;
  finished: boolean;
  onFinish: readonly QuestScriptEffect[];
}>;

export function bumpMatchingGoal(
  quest: QuestDocument,
  goals: readonly HeroQuestGoal[],
  signal: QuestSignal,
): GoalBump | null {
  const current = currentGoal(quest, goals);
  if (!current || !matches(current, signal)) return null;
  const row = goals.find((goal) => goal.goalId === current.id);
  if (!row || row.done === 1) return null;
  const nextValue = nextGoalValue(row, current, signal);
  const done: 0 | 1 = nextValue >= current.limit ? 1 : 0;
  return {
    goal: { ...row, value: nextValue, done },
    finished: done === 1,
    onFinish: done === 1 ? scriptEffects(current.onFinish) : [],
  };
}

function nextGoalValue(row: HeroQuestGoal, goal: QuestGoalDocument, signal: QuestSignal): number {
  if (signal.kind === "loot" || signal.kind === "deliver") {
    return Math.min(goal.limit, signal.count);
  }
  return Math.min(goal.limit, row.value + 1);
}

function matches(goal: QuestGoalDocument, signal: QuestSignal): boolean {
  if (goal.kind !== signal.kind) return false;
  if (signal.kind === "talk" || signal.kind === "win_fight") return true;
  if (signal.kind === "area_action") return goal.actionId === signal.actionId;
  return goal.artikuls.some((artikul) => artikul.artikulId === signal.artikulId);
}
