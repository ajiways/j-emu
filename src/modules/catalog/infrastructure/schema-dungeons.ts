import { sql } from "drizzle-orm";
import { check, integer, pgSchema, primaryKey, smallint, text, uuid } from "drizzle-orm/pg-core";
import { releases } from "../../content/infrastructure/schema.ts";

const catalogSchema = pgSchema("catalog");

export const dungeons = catalogSchema.table(
  "dungeons",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    artikulId: integer("artikul_id").notNull(),
    title: text("title").notNull(),
    startAreaId: text("start_area_id").notNull(),
    parentAreaId: text("parent_area_id").notNull(),
    levelMin: integer("level_min").notNull(),
    durationSec: integer("duration_sec").notNull(),
    imgUrl: text("img_url").notNull(),
    hasClear: smallint("has_clear").notNull(),
    progressFinishValue: integer("progress_finish_value"),
    coinArtikulId: integer("coin_artikul_id"),
    coinMin: integer("coin_min"),
    coinMax: integer("coin_max"),
    lootBossBotId: integer("loot_boss_bot_id"),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.artikulId] }),
    check("dungeons_artikul_id_check", sql`${table.artikulId} > 0`),
    check("dungeons_level_min_check", sql`${table.levelMin} > 0`),
    check("dungeons_duration_sec_check", sql`${table.durationSec} > 0`),
    check("dungeons_has_clear_check", sql`${table.hasClear} IN (0, 1)`),
    check(
      "dungeons_progress_finish_value_check",
      sql`${table.progressFinishValue} IS NULL OR ${table.progressFinishValue} > 0`,
    ),
    check(
      "dungeons_coin_trio_null_check",
      sql`(${table.coinArtikulId} IS NULL) = (${table.coinMin} IS NULL)
        AND (${table.coinArtikulId} IS NULL) = (${table.coinMax} IS NULL)`,
    ),
    check(
      "dungeons_coin_trio_positive_check",
      sql`${table.coinArtikulId} IS NULL OR (
        ${table.coinArtikulId} > 0 AND ${table.coinMin} > 0
        AND ${table.coinMax} >= ${table.coinMin}
      )`,
    ),
    check(
      "dungeons_loot_boss_bot_id_check",
      sql`${table.lootBossBotId} IS NULL OR ${table.lootBossBotId} > 0`,
    ),
  ],
);

export const dungeonPersonalGuaranteed = catalogSchema.table(
  "dungeon_personal_guaranteed",
  {
    releaseId: uuid("release_id").notNull(),
    dungeonArtikulId: integer("dungeon_artikul_id").notNull(),
    lootArtikulId: integer("loot_artikul_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.releaseId, table.dungeonArtikulId, table.lootArtikulId],
    }),
    check(
      "dungeon_personal_guaranteed_dungeon_artikul_id_check",
      sql`${table.dungeonArtikulId} > 0`,
    ),
    check("dungeon_personal_guaranteed_loot_artikul_id_check", sql`${table.lootArtikulId} > 0`),
  ],
);

export const dungeonAreas = catalogSchema.table(
  "dungeon_areas",
  {
    releaseId: uuid("release_id").notNull(),
    artikulId: integer("artikul_id").notNull(),
    areaId: text("area_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.artikulId, table.areaId] }),
    check("dungeon_areas_artikul_id_check", sql`${table.artikulId} > 0`),
  ],
);

export const dungeonSpawns = catalogSchema.table(
  "dungeon_spawns",
  {
    releaseId: uuid("release_id").notNull(),
    artikulId: integer("artikul_id").notNull(),
    areaId: text("area_id").notNull(),
    spawnKey: text("spawn_key").notNull(),
    huntBotId: integer("hunt_bot_id").notNull(),
    isBoss: smallint("is_boss").notNull(),
    countsForClear: smallint("counts_for_clear").notNull(),
    huntMask: text("hunt_mask").notNull(),
    positionX: integer("position_x").notNull(),
    positionY: integer("position_y").notNull(),
    waitMin: integer("wait_min").notNull(),
    waitMax: integer("wait_max").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.releaseId, table.artikulId, table.areaId, table.spawnKey],
    }),
    check("dungeon_spawns_hunt_bot_id_check", sql`${table.huntBotId} > 0`),
    check("dungeon_spawns_is_boss_check", sql`${table.isBoss} IN (0, 1)`),
    check("dungeon_spawns_counts_for_clear_check", sql`${table.countsForClear} IN (0, 1)`),
    check("dungeon_spawns_wait_check", sql`${table.waitMax} >= ${table.waitMin}`),
    check("dungeon_spawns_wait_min_check", sql`${table.waitMin} >= 0`),
  ],
);

export const dungeonSpawnEncounters = catalogSchema.table(
  "dungeon_spawn_encounters",
  {
    releaseId: uuid("release_id").notNull(),
    artikulId: integer("artikul_id").notNull(),
    areaId: text("area_id").notNull(),
    spawnKey: text("spawn_key").notNull(),
    botId: integer("bot_id").notNull(),
    count: integer("count").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.releaseId, table.artikulId, table.areaId, table.spawnKey, table.botId],
    }),
    check("dungeon_spawn_encounters_bot_id_check", sql`${table.botId} > 0`),
    check("dungeon_spawn_encounters_count_check", sql`${table.count} > 0`),
  ],
);

export const dungeonSpawnRoutes = catalogSchema.table(
  "dungeon_spawn_routes",
  {
    releaseId: uuid("release_id").notNull(),
    artikulId: integer("artikul_id").notNull(),
    areaId: text("area_id").notNull(),
    spawnKey: text("spawn_key").notNull(),
    ord: integer("ord").notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    waitMin: integer("wait_min").notNull(),
    waitMax: integer("wait_max").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.releaseId, table.artikulId, table.areaId, table.spawnKey, table.ord],
    }),
    check("dungeon_spawn_routes_ord_check", sql`${table.ord} >= 0`),
    check("dungeon_spawn_routes_wait_check", sql`${table.waitMax} >= ${table.waitMin}`),
    check("dungeon_spawn_routes_wait_min_check", sql`${table.waitMin} >= 0`),
  ],
);

export const dungeonSpawnZones = catalogSchema.table(
  "dungeon_spawn_zones",
  {
    releaseId: uuid("release_id").notNull(),
    artikulId: integer("artikul_id").notNull(),
    areaId: text("area_id").notNull(),
    spawnKey: text("spawn_key").notNull(),
    ord: integer("ord").notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.releaseId, table.artikulId, table.areaId, table.spawnKey, table.ord],
    }),
    check("dungeon_spawn_zones_artikul_id_check", sql`${table.artikulId} > 0`),
    check("dungeon_spawn_zones_ord_check", sql`${table.ord} >= 0`),
  ],
);
