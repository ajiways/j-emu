import type { QuestBookSnapshot } from "../../quests/domain/quest-book-snapshot.ts";
import type { BookTrioBlocks } from "./book-quest-blocks.ts";

export function bookTrioFromSnapshot(snapshot: QuestBookSnapshot): BookTrioBlocks {
  const rows = snapshot.filterType === "finished" ? snapshot.finished : snapshot.active;
  const quests: Record<
    string,
    Readonly<{ id: number; title: string; description: string; flags: number }>
  > = {};
  for (const row of rows) {
    quests[String(row.bookId)] = {
      id: row.bookId,
      title: row.title,
      description: row.description,
      flags: row.flags,
    };
  }
  return {
    "book|quest_list": {
      status: 100,
      filter_type: snapshot.filterType,
      quests,
      finished_quests_id: snapshot.finishedIds,
      macros_list: [],
    },
    "book|quest_targets": {
      status: 100,
      target_list: snapshot.targets.map((row) => ({
        quest_id: row.bookId,
        title: row.title,
        kind: row.kind,
      })),
      macros_list: [],
    },
    "book|quest_counters": {
      status: 100,
      counter_list: snapshot.targets.map((row) => ({
        quest_id: row.bookId,
        title: row.title,
        value: row.value,
        limit: row.limit,
      })),
    },
  };
}
