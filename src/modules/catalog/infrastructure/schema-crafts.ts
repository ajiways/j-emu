import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { releases } from "../../content/infrastructure/schema.ts";
import type { CraftIngredient } from "../domain/craft-recipe-definition.ts";

const catalogSchema = pgSchema("catalog");

export const craftRecipes = catalogSchema.table(
  "craft_recipes",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    id: integer("id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    artikulId: integer("artikul_id").notNull(),
    type: integer("type").notNull(),
    professionId: integer("profession_id").notNull(),
    skillValue: integer("skill_value").notNull(),
    maxSkillValue: integer("max_skill_value").notNull(),
    ingredients: jsonb("ingredients").$type<readonly CraftIngredient[]>().notNull(),
    duration: integer("duration").notNull(),
    createArtikulId: integer("create_artikul_id").notNull(),
    createArtikulNum: integer("create_artikul_num").notNull(),
    createQuality: integer("create_quality").notNull(),
    createTypeId: integer("create_type_id").notNull(),
    createTitle: text("create_title").notNull(),
    createLevelMin: integer("create_level_min").notNull(),
    tableId: integer("table_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.id] }),
    uniqueIndex("craft_recipes_release_artikul_uidx").on(table.releaseId, table.artikulId),
    check("craft_recipes_id_check", sql`${table.id} > 0`),
    check("craft_recipes_artikul_id_check", sql`${table.artikulId} > 0`),
    check("craft_recipes_type_check", sql`${table.type} = 1`),
    check(
      "craft_recipes_profession_id_check",
      sql`${table.professionId} >= 1 AND ${table.professionId} <= 16`,
    ),
    check("craft_recipes_skill_value_check", sql`${table.skillValue} >= 0`),
    check("craft_recipes_max_skill_value_check", sql`${table.maxSkillValue} > 0`),
    check("craft_recipes_duration_check", sql`${table.duration} >= 0`),
    check("craft_recipes_create_artikul_id_check", sql`${table.createArtikulId} > 0`),
    check("craft_recipes_create_artikul_num_check", sql`${table.createArtikulNum} > 0`),
    check("craft_recipes_create_quality_check", sql`${table.createQuality} >= 0`),
    check("craft_recipes_create_type_id_check", sql`${table.createTypeId} >= 0`),
    check("craft_recipes_create_level_min_check", sql`${table.createLevelMin} >= 0`),
    check("craft_recipes_table_id_check", sql`${table.tableId} >= 0`),
  ],
);
