import type { QuestDocument, QuestGoalDocument } from "../../content/domain/content-quest.ts";
import {
  DAILY_CYCLE_RULES,
  journalTimes,
  shouldListFinishedDaily,
  shouldListInFinishedIds,
} from "./daily-cycle-rules.ts";
import type { HeroQuest, HeroQuestGoal } from "./hero-quest.ts";
import { currentGoal } from "./prior-gate.ts";

type QuestBookRow = Readonly<{
  bookId: number;
  title: string;
  description: string;
  flags: number;
  status: "started" | "finished";
  cooldown: number;
  multitime: 0 | 1;
  ftime: number;
  stime: number;
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
  const startedFilter = filterType === "started";
  const byKey = new Map(progress.map((row) => [row.questKey, row]));
  const active: QuestBookRow[] = [];
  const finished: QuestBookRow[] = [];
  const finishedIds: number[] = [];
  const targets: QuestBookTarget[] = [];
  for (const quest of quests) {
    const row = byKey.get(quest.key);
    if (!row) continue;
    const times = journalTimes(
      {
        flags: quest.flags,
        status: row.status,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
      },
      DAILY_CYCLE_RULES,
    );
    const book: QuestBookRow = {
      bookId: quest.bookId,
      title: quest.title,
      description: quest.description,
      flags: quest.flags,
      status: row.status === "done" ? "finished" : "started",
      cooldown: times.cooldown,
      multitime: times.multitime,
      ftime: times.ftime,
      stime: times.stime,
    };
    if (row.status === "done") {
      if (shouldListInFinishedIds(quest.flags, row.status)) {
        finished.push(book);
        finishedIds.push(quest.bookId);
      }
      if (startedFilter && shouldListFinishedDaily(quest.flags, row.status, row.hiddenInJournal)) {
        active.push(book);
      }
      continue;
    }
    if (!startedFilter) continue;
    active.push(book);
    const goals = goalsByKey.get(quest.key);
    if (!goals) throw new Error(`Hero quest ${quest.key} goals are missing`);
    const goal = currentGoal(quest, goals);
    if (!goal) continue;
    const progressGoal = goals.find((item) => item.goalId === goal.id);
    if (!progressGoal) throw new Error(`Hero quest ${quest.key} goal ${goal.id} is missing`);
    targets.push({
      bookId: quest.bookId,
      title: goal.title,
      kind: goal.kind,
      value: progressGoal.value,
      limit: goal.limit,
    });
  }
  return {
    filterType,
    active,
    finished,
    finishedIds: [...finishedIds].sort((left, right) => left - right),
    targets,
  };
}
