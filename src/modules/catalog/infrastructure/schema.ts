import { sql } from "drizzle-orm";
import { check, integer, pgSchema, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { releases } from "../../content/infrastructure/schema.ts";

export const catalogSchema = pgSchema("catalog");

export const artifacts = catalogSchema.table(
  "artifacts",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    id: integer("id").notNull(),
    title: text("title").notNull(),
    picture: text("picture").notNull(),
    typeId: text("type_id").notNull(),
    kindId: integer("kind_id").notNull(),
    slotMask: integer("slot_mask").notNull(),
    weight: integer("weight").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.id] }),
    check("artifacts_weight_check", sql`${table.weight} >= 0`),
  ],
);

export const bots = catalogSchema.table(
  "bots",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    id: integer("id").notNull(),
    title: text("title").notNull(),
    level: integer("level").notNull(),
    maxHp: integer("max_hp").notNull(),
    strength: integer("strength").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.id] }),
    check("bots_level_check", sql`${table.level} > 0`),
    check("bots_max_hp_check", sql`${table.maxHp} > 0`),
    check("bots_strength_check", sql`${table.strength} >= 0`),
  ],
);
