import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  type ExtraConfigColumn,
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

const flagCheck = (column: ExtraConfigColumn, name: string) =>
  check(name, sql`${column} IN (0, 1)`);

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
    regionMap: text("region_map").notNull(),
    ftimeMax: integer("ftime_max").notNull(),
    code: text("code").notNull(),
    context: text("context").notNull(),
    soundIntro: text("sound_intro").notNull(),
    soundBg: text("sound_bg").notNull(),
    instArtikulId: integer("inst_artikul_id").notNull(),
    haveTradeChannel: integer("have_trade_channel").notNull(),
    haveKindChannel: integer("have_kind_channel").notNull(),
    hideFinishedFights: integer("hide_finished_fights").notNull(),
    hideRunningFights: integer("hide_running_fights").notNull(),
    noClanChat: integer("no_clan_chat").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.id] }),
    check("areas_ftime_max_check", sql`${table.ftimeMax} >= 0`),
    check("areas_inst_artikul_id_check", sql`${table.instArtikulId} >= 0`),
    flagCheck(table.haveTradeChannel, "areas_have_trade_channel_check"),
    flagCheck(table.haveKindChannel, "areas_have_kind_channel_check"),
    flagCheck(table.hideFinishedFights, "areas_hide_finished_fights_check"),
    flagCheck(table.hideRunningFights, "areas_hide_running_fights_check"),
    flagCheck(table.noClanChat, "areas_no_clan_chat_check"),
  ],
);

export const huntSpawns = worldSchema.table(
  "hunt_spawns",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    id: integer("id").notNull(),
    areaId: text("area_id").notNull(),
    botId: integer("bot_id").notNull(),
    positionX: doublePrecision("position_x").notNull(),
    positionY: doublePrecision("position_y").notNull(),
    huntMask: text("hunt_mask").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.id] }),
    check("hunt_spawns_id_check", sql`${table.id} > 0`),
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
