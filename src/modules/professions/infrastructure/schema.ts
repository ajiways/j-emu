import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  integer,
  pgSchema,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { heroes } from "../../character/infrastructure/schema.ts";

export const professionsSchema = pgSchema("professions");

export const heroAssistants = professionsSchema.table(
  "hero_assistants",
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
    artikulId: integer("artikul_id").notNull(),
    nick: text("nick").notNull(),
    skillSpeed: integer("skill_speed").notNull(),
    skillDefence: integer("skill_defence").notNull(),
    skillIntellect: integer("skill_intellect").notNull(),
    tactics: integer("tactics").notNull(),
    farmId: integer("farm_id").notNull(),
    areaId: text("area_id").notNull(),
    ftime: integer("ftime").notNull(),
    stime: integer("stime").notNull(),
    attackAt: integer("attack_at").notNull(),
    stamina: doublePrecision("stamina").notNull(),
    staminaResetTime: integer("stamina_reset_time").notNull(),
    masteryValue: integer("mastery_value").notNull(),
    resultType: integer("result_type").notNull(),
    resultValue: text("result_value").notNull(),
    flags: integer("flags").notNull(),
    cycleResult: text("cycle_result").notNull(),
    lootGranted: boolean("loot_granted").notNull(),
  },
  (table) => [
    check("hero_assistants_hero_id_check", sql`${table.heroId} > 0`),
    check("hero_assistants_artikul_id_check", sql`${table.artikulId} > 0`),
    check("hero_assistants_skill_speed_check", sql`${table.skillSpeed} >= 0`),
    check("hero_assistants_skill_defence_check", sql`${table.skillDefence} >= 0`),
    check("hero_assistants_skill_intellect_check", sql`${table.skillIntellect} >= 0`),
    check("hero_assistants_tactics_check", sql`${table.tactics} >= 0 AND ${table.tactics} <= 2`),
    check("hero_assistants_farm_id_check", sql`${table.farmId} >= 0`),
    check("hero_assistants_ftime_check", sql`${table.ftime} >= 0`),
    check("hero_assistants_stime_check", sql`${table.stime} >= 0`),
    check("hero_assistants_attack_at_check", sql`${table.attackAt} >= 0`),
    check("hero_assistants_stamina_check", sql`${table.stamina} >= 0 AND ${table.stamina} <= 100`),
    check("hero_assistants_stamina_reset_time_check", sql`${table.staminaResetTime} >= 0`),
    check("hero_assistants_mastery_value_check", sql`${table.masteryValue} >= 0`),
    check("hero_assistants_result_type_check", sql`${table.resultType} >= 0`),
    check("hero_assistants_flags_check", sql`${table.flags} >= 0`),
  ],
);

export const heroFarmStats = professionsSchema.table(
  "hero_farm_stats",
  {
    heroId: integer("hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "restrict" }),
    farmId: integer("farm_id").notNull(),
    value: integer("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.heroId, table.farmId] }),
    check("hero_farm_stats_hero_id_check", sql`${table.heroId} > 0`),
    check("hero_farm_stats_farm_id_check", sql`${table.farmId} > 0`),
    check("hero_farm_stats_value_check", sql`${table.value} > 0`),
  ],
);

export const farmStocks = professionsSchema.table(
  "farm_stocks",
  {
    areaId: text("area_id").notNull(),
    huntSpotId: integer("hunt_spot_id").notNull(),
    farmId: integer("farm_id").notNull(),
    cntCurrent: integer("cnt_current").notNull(),
    lastRespawnTime: integer("last_respawn_time").notNull(),
    nextRespawnTime: integer("next_respawn_time").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.areaId, table.huntSpotId] }),
    check("farm_stocks_hunt_spot_id_check", sql`${table.huntSpotId} > 0`),
    check("farm_stocks_farm_id_check", sql`${table.farmId} > 0`),
    check("farm_stocks_cnt_current_check", sql`${table.cntCurrent} >= 0`),
    check("farm_stocks_last_respawn_time_check", sql`${table.lastRespawnTime} >= 0`),
    check("farm_stocks_next_respawn_time_check", sql`${table.nextRespawnTime} >= 0`),
  ],
);

export const heroRecipes = professionsSchema.table(
  "hero_recipes",
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
    recipeId: integer("recipe_id").notNull(),
    ftime: integer("ftime").notNull(),
    flags: integer("flags").notNull(),
  },
  (table) => [
    uniqueIndex("hero_recipes_hero_recipe_uidx").on(table.heroId, table.recipeId),
    check("hero_recipes_hero_id_check", sql`${table.heroId} > 0`),
    check("hero_recipes_recipe_id_check", sql`${table.recipeId} > 0`),
    check("hero_recipes_ftime_check", sql`${table.ftime} >= 0`),
    check("hero_recipes_flags_check", sql`${table.flags} >= 0`),
  ],
);
