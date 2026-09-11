import type { QuestDocument, QuestGoalDocument } from "../../content/domain/content-quest.ts";
import type { HeroQuest, HeroQuestGoal } from "./hero-quest.ts";
import { currentGoal } from "./prior-gate.ts";

type QuestBookRow = Readonly<{
  bookId: number;
  title: string;
  description: string;
  flags: number;
}>;

type QuestBookTarget = Readonly<{
  bookId: number;
  title: string;
  kind: QuestGoalDocument["kind"];
  value: number;
  limit: number;
}>;

export type QuestBookSnapshot = Readonly<{
  filterType: string;
  active: readonly QuestBookRow[];
  finished: readonly QuestBookRow[];
  finishedIds: readonly number[];
  targets: readonly QuestBookTarget[];
}>;

export function questBookSnapshot(
  filterType: string,
  quests: readonly QuestDocument[],
  progress: readonly HeroQuest[],
  goalsByKey: ReadonlyMap<string, readonly HeroQuestGoal[]>,
): QuestBookSnapshot {
  if (!filterType) throw new Error("book|quest_list filter_type is required");
  const byKey = new Map(progress.map((row) => [row.questKey, row]));
  const active: QuestBookRow[] = [];
  const finished: QuestBookRow[] = [];
  const targets: QuestBookTarget[] = [];
  for (const quest of quests) {
    const row = byKey.get(quest.key);
    if (!row) continue;
    const book = {
      bookId: quest.bookId,
      title: quest.title,
      description: quest.description,
      flags: quest.flags,
    };
    if (row.status === "done") {
      finished.push(book);
      continue;
    }
    active.push(book);
    const goals = goalsByKey.get(quest.key) ?? [];
    const goal = currentGoal(quest, goals);
    if (!goal) continue;
    targets.push({
      bookId: quest.bookId,
      title: goal.title,
      kind: goal.kind,
      value: goals.find((item) => item.goalId === goal.id)?.value ?? 0,
      limit: goal.limit,
    });
  }
  return {
    filterType,
    active,
    finished,
    finishedIds: finished.map((row) => row.bookId).sort((left, right) => left - right),
    targets,
  };
}
