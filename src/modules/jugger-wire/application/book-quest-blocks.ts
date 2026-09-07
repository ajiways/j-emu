type BookQuestListBlock = Readonly<{
  status: 100;
  filter_type: string;
  quests: Readonly<Record<string, never>>;
  finished_quests_id: readonly [];
  macros_list: readonly [];
}>;

type BookQuestTargetsBlock = Readonly<{
  status: 100;
  target_list: readonly [];
  macros_list: readonly [];
}>;

type BookQuestCountersBlock = Readonly<{
  status: 100;
  counter_list: readonly [];
}>;

export type BookTrioBlocks = Readonly<{
  "book|quest_list": BookQuestListBlock;
  "book|quest_targets": BookQuestTargetsBlock;
  "book|quest_counters": BookQuestCountersBlock;
}>;

export function emptyBookTrio(filterType: string): BookTrioBlocks {
  if (!filterType) throw new Error("book|quest_list filter_type is required");
  return {
    "book|quest_list": {
      status: 100,
      filter_type: filterType,
      quests: {},
      finished_quests_id: [],
      macros_list: [],
    },
    "book|quest_targets": { status: 100, target_list: [], macros_list: [] },
    "book|quest_counters": { status: 100, counter_list: [] },
  };
}
