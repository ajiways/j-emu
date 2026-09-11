import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { heroes } from "../../character/infrastructure/schema.ts";

export const questsProgressSchema = pgSchema("quests");

export const heroQuests = questsProgressSchema.table(
  "hero_quests",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity({
      startWith: 1,
      minValue: 1,
      maxValue: 2_147_483_647,
      cycle: false,
    }),
    heroId: integer("hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "restrict" }),
    questKey: text("quest_key").notNull(),
    bookId: integer("book_id").notNull(),
    status: text("status").notNull(),
    dialogStep: integer("dialog_step").notNull(),
    dialogCursor: text("dialog_cursor").notNull(),
    waitingActionId: integer("waiting_action_id"),
    waitingTitle: text("waiting_title"),
    waitingDurationSec: integer("waiting_duration_sec"),
    waitingPopup: text("waiting_popup"),
    waitingStartedAt: timestamp("waiting_started_at", { withTimezone: true, mode: "date" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
    hiddenInJournal: integer("hidden_in_journal").notNull().default(0),
  },
  (table) => [
    uniqueIndex("hero_quests_hero_quest_uidx").on(table.heroId, table.questKey),
    check("hero_quests_hero_id_check", sql`${table.heroId} > 0`),
    check("hero_quests_book_id_check", sql`${table.bookId} > 0`),
    check("hero_quests_status_check", sql`${table.status} in ('active','done')`),
    check("hero_quests_hidden_in_journal_check", sql`${table.hiddenInJournal} in (0, 1)`),
    check("hero_quests_dialog_step_check", sql`${table.dialogStep} >= 0`),
    check(
      "hero_quests_waiting_action_id_check",
      sql`${table.waitingActionId} IS NULL OR ${table.waitingActionId} > 0`,
    ),
    check(
      "hero_quests_waiting_duration_sec_check",
      sql`${table.waitingDurationSec} IS NULL OR ${table.waitingDurationSec} >= 0`,
    ),
  ],
);

export const heroQuestGoals = questsProgressSchema.table(
  "hero_quest_goals",
  {
    heroId: integer("hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "restrict" }),
    questKey: text("quest_key").notNull(),
    goalId: text("goal_id").notNull(),
    goalOrd: integer("goal_ord").notNull(),
    done: integer("done").notNull(),
    value: integer("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.heroId, table.questKey, table.goalId] }),
    check("hero_quest_goals_hero_id_check", sql`${table.heroId} > 0`),
    check("hero_quest_goals_goal_ord_check", sql`${table.goalOrd} > 0`),
    check("hero_quest_goals_done_check", sql`${table.done} in (0, 1)`),
    check("hero_quest_goals_value_check", sql`${table.value} >= 0`),
  ],
);

export const heroFacts = questsProgressSchema.table(
  "hero_facts",
  {
    heroId: integer("hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "restrict" }),
    factId: text("fact_id").notNull(),
    value: text("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.heroId, table.factId] }),
    check("hero_facts_hero_id_check", sql`${table.heroId} > 0`),
  ],
);
