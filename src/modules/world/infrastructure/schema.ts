import {
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { bots } from "../../catalog/infrastructure/schema.ts";
import { releases } from "../../content/infrastructure/schema.ts";

export const worldSchema = pgSchema("world");

export const areas = worldSchema.table(
  "areas",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    id: text("id").notNull(),
    title: text("title").notNull(),
    mapAsset: text("map_asset").notNull(),
    fightBackground: text("fight_background").notNull(),
  },
  (table) => [primaryKey({ columns: [table.releaseId, table.id] })],
);

export const huntSpawns = worldSchema.table(
  "hunt_spawns",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    id: text("id").notNull(),
    areaId: text("area_id").notNull(),
    botId: integer("bot_id").notNull(),
    positionX: doublePrecision("position_x").notNull(),
    positionY: doublePrecision("position_y").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.id] }),
    foreignKey({
      name: "hunt_spawns_area_fk",
      columns: [table.releaseId, table.areaId],
      foreignColumns: [areas.releaseId, areas.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "hunt_spawns_bot_fk",
      columns: [table.releaseId, table.botId],
      foreignColumns: [bots.releaseId, bots.id],
    }).onDelete("restrict"),
    index("world_hunt_spawns_area_idx").on(table.releaseId, table.areaId),
  ],
);
