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
    huntNick: text("hunt_nick").notNull(),
    huntSwf: text("hunt_swf").notNull(),
    huntScale: integer("hunt_scale").notNull(),
    huntFps: integer("hunt_fps").notNull(),
    huntSpeed: integer("hunt_speed").notNull(),
    huntAvatar: text("hunt_avatar").notNull(),
    huntKind: integer("hunt_kind").notNull(),
    huntHideOnMap: integer("hunt_hide_on_map").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.id] }),
    check("bots_level_check", sql`${table.level} > 0`),
    check("bots_max_hp_check", sql`${table.maxHp} > 0`),
    check("bots_strength_check", sql`${table.strength} >= 0`),
    check("bots_hunt_scale_check", sql`${table.huntScale} > 0`),
    check("bots_hunt_fps_check", sql`${table.huntFps} > 0`),
    check("bots_hunt_speed_check", sql`${table.huntSpeed} >= 0`),
    check("bots_hunt_kind_check", sql`${table.huntKind} >= 0`),
    check("bots_hunt_hide_on_map_check", sql`${table.huntHideOnMap} IN (0, 1)`),
  ],
);
