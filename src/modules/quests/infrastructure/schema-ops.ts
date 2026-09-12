import { sql } from "drizzle-orm";
import { check, integer, pgSchema, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { releases } from "../../content/infrastructure/schema.ts";

export const questsOpsSchema = pgSchema("quests");

export const questGoalArtikuls = questsOpsSchema.table(
  "quest_goal_artikuls",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    questKey: text("quest_key").notNull(),
    goalId: text("goal_id").notNull(),
    role: text("role").notNull(),
    artikulId: integer("artikul_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.releaseId, table.questKey, table.goalId, table.role, table.artikulId],
    }),
    check("quest_goal_artikuls_artikul_id_check", sql`${table.artikulId} > 0`),
    check(
      "quest_goal_artikuls_role_check",
      sql`${table.role} in ('kill','buy','equip','loot','deliver','loot_mob')`,
    ),
  ],
);

export const questDialogSteps = questsOpsSchema.table(
  "quest_dialog_steps",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    questKey: text("quest_key").notNull(),
    stepOrd: integer("step_ord").notNull(),
    type: text("type").notNull(),
    text: text("text").notNull(),
    stepId: text("step_id").notNull(),
    nextKey: text("next_key").notNull(),
    goalId: text("goal_id").notNull(),
    answer: text("answer").notNull(),
    toFight: integer("to_fight").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.questKey, table.stepOrd] }),
    check("quest_dialog_steps_step_ord_check", sql`${table.stepOrd} >= 0`),
    check("quest_dialog_steps_to_fight_check", sql`${table.toFight} in (0, 1)`),
    check(
      "quest_dialog_steps_type_check",
      sql`${table.type} in ('npc','note','stage','goal','player','reward')`,
    ),
  ],
);

export const questScriptOps = questsOpsSchema.table(
  "quest_script_ops",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    questKey: text("quest_key").notNull(),
    hook: text("hook").notNull(),
    ownerKey: text("owner_key").notNull(),
    opOrd: integer("op_ord").notNull(),
    type: text("type").notNull(),
    artikulId: integer("artikul_id"),
    count: integer("count"),
    professionId: integer("profession_id"),
    flag: text("flag"),
    value: text("value"),
    text: text("text"),
    goalId: text("goal_id"),
    fightMode: text("fight_mode"),
    chatStart: text("chat_start"),
    chatWin: text("chat_win"),
    chatLose: text("chat_lose"),
  },
  (table) => [
    primaryKey({
      columns: [table.releaseId, table.questKey, table.hook, table.ownerKey, table.opOrd],
    }),
    check("quest_script_ops_op_ord_check", sql`${table.opOrd} >= 0`),
    check(
      "quest_script_ops_hook_check",
      sql`${table.hook} in ('dialog','goal_on_finish','reward','on_accept')`,
    ),
    check(
      "quest_script_ops_type_check",
      sql`${table.type} in ('START_FIGHT','GRANT_ARTIKUL','GRANT_PROFESSION','REMOVE_ARTIKUL','MSG','SET_FLAG','CLEAR_FLAG','BUMP_GOAL','COMPLETE_GOAL','GRANT_AWARDS','JUMP_AREA')`,
    ),
  ],
);

export const questScriptFightRoster = questsOpsSchema.table(
  "quest_script_fight_roster",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    questKey: text("quest_key").notNull(),
    hook: text("hook").notNull(),
    ownerKey: text("owner_key").notNull(),
    side: text("side").notNull(),
    ord: integer("ord").notNull(),
    artikulId: integer("artikul_id").notNull(),
    count: integer("count").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.releaseId, table.questKey, table.hook, table.ownerKey, table.side, table.ord],
    }),
    check("quest_script_fight_roster_ord_check", sql`${table.ord} >= 0`),
    check("quest_script_fight_roster_artikul_id_check", sql`${table.artikulId} > 0`),
    check("quest_script_fight_roster_count_check", sql`${table.count} > 0`),
    check("quest_script_fight_roster_side_check", sql`${table.side} in ('enemy','ally')`),
  ],
);
