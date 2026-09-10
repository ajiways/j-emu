import { sql } from "drizzle-orm";
import { check, integer, pgSchema, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { releases } from "../../content/infrastructure/schema.ts";

const catalogSchema = pgSchema("catalog");

export const professions = catalogSchema.table(
  "professions",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    id: integer("id").notNull(),
    title: text("title").notNull(),
    type: integer("type").notNull(),
    skillId: text("skill_id").notNull(),
    picture: text("picture").notNull(),
    position: integer("position").notNull(),
    skillStepOverride: integer("skill_step_override"),
    skillMinlvlOverride: integer("skill_minlvl_override"),
    description: text("description").notNull(),
    infoUrl: text("info_url").notNull(),
    userStatId: integer("user_stat_id"),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.id] }),
    check("professions_id_check", sql`${table.id} >= 1 AND ${table.id} <= 16`),
    check("professions_type_check", sql`${table.type} IN (1, 2)`),
    check("professions_position_check", sql`${table.position} > 0`),
  ],
);
