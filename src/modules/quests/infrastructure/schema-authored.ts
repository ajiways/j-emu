import { sql } from "drizzle-orm";
import { check, integer, pgSchema, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { releases } from "../../content/infrastructure/schema.ts";

export const questsSchema = pgSchema("quests");

export const npcs = questsSchema.table(
  "npcs",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    id: integer("id").notNull(),
    infoId: integer("info_id").notNull(),
    title: text("title").notNull(),
    picture: text("picture").notNull(),
    description: text("description").notNull(),
    elsetext: text("elsetext").notNull(),
    areaId: text("area_id").notNull(),
    itemId: integer("item_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.id] }),
    uniqueIndex("npcs_release_area_item_uidx").on(table.releaseId, table.areaId, table.itemId),
    check("npcs_id_check", sql`${table.id} > 0`),
    check("npcs_info_id_check", sql`${table.infoId} > 0`),
    check("npcs_item_id_check", sql`${table.itemId} > 0`),
  ],
);

export const worldFacts = questsSchema.table(
  "world_facts",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    id: text("id").notNull(),
    values: text("values").notNull(),
  },
  (table) => [primaryKey({ columns: [table.releaseId, table.id] })],
);

export const authoredQuests = questsSchema.table(
  "quests",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    key: text("key").notNull(),
    bookId: integer("book_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    awardDescription: text("award_description").notNull(),
    flags: integer("flags").notNull(),
    levelMin: integer("level_min").notNull(),
    levelMax: integer("level_max").notNull(),
    npcId: integer("npc_id").notNull(),
    pointId: integer("point_id").notNull(),
    boardOrd: integer("board_ord").notNull(),
    welcomeOffer: text("welcome_offer").notNull(),
    welcomeActive: text("welcome_active").notNull(),
    welcomeReady: text("welcome_ready").notNull(),
    awardExp: integer("award_exp").notNull(),
    awardMoneyMinor: integer("award_money_minor").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.key] }),
    uniqueIndex("quests_release_book_uidx").on(table.releaseId, table.bookId),
    uniqueIndex("quests_release_point_uidx").on(table.releaseId, table.pointId),
    check("quests_book_id_check", sql`${table.bookId} > 0`),
    check("quests_flags_check", sql`${table.flags} >= 0`),
    check("quests_level_min_check", sql`${table.levelMin} > 0`),
    check("quests_level_max_check", sql`${table.levelMax} >= 0`),
    check("quests_npc_id_check", sql`${table.npcId} > 0`),
    check("quests_point_id_check", sql`${table.pointId} > 0`),
    check("quests_board_ord_check", sql`${table.boardOrd} > 0`),
    check("quests_award_exp_check", sql`${table.awardExp} >= 0`),
    check("quests_award_money_minor_check", sql`${table.awardMoneyMinor} >= 0`),
  ],
);

export const npcQuests = questsSchema.table(
  "npc_quests",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    npcId: integer("npc_id").notNull(),
    questKey: text("quest_key").notNull(),
    boardOrd: integer("board_ord").notNull(),
    pointId: integer("point_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.npcId, table.questKey] }),
    check("npc_quests_npc_id_check", sql`${table.npcId} > 0`),
    check("npc_quests_board_ord_check", sql`${table.boardOrd} > 0`),
    check("npc_quests_point_id_check", sql`${table.pointId} > 0`),
  ],
);

export const questAwardItems = questsSchema.table(
  "quest_award_items",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    questKey: text("quest_key").notNull(),
    artikulId: integer("artikul_id").notNull(),
    count: integer("count").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.questKey, table.artikulId] }),
    check("quest_award_items_artikul_id_check", sql`${table.artikulId} > 0`),
    check("quest_award_items_count_check", sql`${table.count} > 0`),
  ],
);

export const questGoals = questsSchema.table(
  "quest_goals",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    questKey: text("quest_key").notNull(),
    goalId: text("goal_id").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    goalOrd: integer("goal_ord").notNull(),
    limitValue: integer("limit_value").notNull(),
    actionId: integer("action_id").notNull(),
    objectId: integer("object_id").notNull(),
    waitingTitle: text("waiting_title").notNull(),
    waitingDurationSec: integer("waiting_duration_sec").notNull(),
    waitingPopup: text("waiting_popup").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.questKey, table.goalId] }),
    check("quest_goals_goal_ord_check", sql`${table.goalOrd} > 0`),
    check("quest_goals_limit_value_check", sql`${table.limitValue} > 0`),
    check("quest_goals_action_id_check", sql`${table.actionId} >= 0`),
    check("quest_goals_object_id_check", sql`${table.objectId} >= 0`),
    check("quest_goals_waiting_duration_sec_check", sql`${table.waitingDurationSec} >= 0`),
    check(
      "quest_goals_kind_check",
      sql`${table.kind} in ('talk','kill','loot','buy','equip','deliver','area_action','win_fight')`,
    ),
  ],
);
