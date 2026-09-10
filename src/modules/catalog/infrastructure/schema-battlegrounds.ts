import { sql } from "drizzle-orm";
import { check, integer, pgSchema, primaryKey, smallint, text, uuid } from "drizzle-orm/pg-core";
import { releases } from "../../content/infrastructure/schema.ts";

const catalogSchema = pgSchema("catalog");

export const battlegrounds = catalogSchema.table(
  "battlegrounds",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    id: integer("id").notNull(),
    title: text("title").notNull(),
    flags: integer("flags").notNull(),
    available: smallint("available").notNull(),
    queueLevel: text("queue_level").notNull(),
    error: text("error").notNull(),
    playable: smallint("playable").notNull(),
    instArtikulId: integer("inst_artikul_id").notNull(),
    levelMin: integer("level_min").notNull(),
    levelMax: integer("level_max").notNull(),
    returnAreaId: text("return_area_id").notNull(),
    westAreaId: text("west_area_id").notNull(),
    arenaAreaId: text("arena_area_id").notNull(),
    eastAreaId: text("east_area_id").notNull(),
    inviteTtlSec: integer("invite_ttl_sec").notNull(),
    banSec: integer("ban_sec").notNull(),
    matchDurationSec: integer("match_duration_sec").notNull(),
    maxScore: integer("max_score").notNull(),
    pointsPerKill: integer("points_per_kill").notNull(),
    fightBg: text("fight_bg").notNull(),
    fightFlags: text("fight_flags").notNull(),
    mapPicture: text("map_picture").notNull(),
    statsPicture: text("stats_picture").notNull(),
    description: text("description").notNull(),
    rules: text("rules").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.type, table.id] }),
    check("battlegrounds_id_check", sql`${table.id} > 0`),
    check("battlegrounds_available_check", sql`${table.available} IN (0, 1)`),
    check("battlegrounds_playable_check", sql`${table.playable} IN (0, 1)`),
    check("battlegrounds_flags_check", sql`${table.flags} >= 0`),
  ],
);

export const battlegroundRooms = catalogSchema.table(
  "battleground_rooms",
  {
    releaseId: uuid("release_id").notNull(),
    type: text("type").notNull(),
    id: integer("id").notNull(),
    areaId: text("area_id").notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    title: text("title").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.type, table.id, table.areaId] }),
    check("battleground_rooms_id_check", sql`${table.id} > 0`),
  ],
);

export const battlegroundLeaderGroups = catalogSchema.table(
  "battleground_leader_groups",
  {
    releaseId: uuid("release_id").notNull(),
    type: text("type").notNull(),
    id: integer("id").notNull(),
    groupId: text("group_id").notNull(),
    minLevel: text("min_level").notNull(),
    maxLevel: text("max_level").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.type, table.id, table.groupId] }),
    check("battleground_leader_groups_id_check", sql`${table.id} > 0`),
  ],
);
