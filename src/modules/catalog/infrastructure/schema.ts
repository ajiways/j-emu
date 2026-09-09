import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  foreignKey,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
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
    levelMin: integer("level_min").notNull(),
    levelMax: integer("level_max").notNull(),
    gender: integer("gender").notNull(),
    priceMinor: integer("price_minor").notNull(),
    flags: integer("flags").notNull(),
    bagStack: integer("bag_stack").notNull(),
    durability: integer("durability").notNull(),
    durabilityMax: integer("durability_max").notNull(),
    skills: jsonb("skills").notNull(),
    artifactActions: jsonb("artifact_actions").notNull(),
    extra: jsonb("extra").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.id] }),
    check("artifacts_weight_check", sql`${table.weight} >= 0`),
    check("artifacts_level_min_check", sql`${table.levelMin} >= 0`),
    check("artifacts_level_max_check", sql`${table.levelMax} >= 0`),
    check("artifacts_gender_check", sql`${table.gender} >= 0`),
    check("artifacts_price_minor_check", sql`${table.priceMinor} >= 0`),
    check("artifacts_flags_check", sql`${table.flags} >= 0`),
    check("artifacts_bag_stack_check", sql`${table.bagStack} >= 1`),
    check("artifacts_durability_check", sql`${table.durability} >= 0`),
    check("artifacts_durability_max_check", sql`${table.durabilityMax} >= 0`),
    check("artifacts_durability_range_check", sql`${table.durability} <= ${table.durabilityMax}`),
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
    huntSk: text("hunt_sk").notNull(),
    huntBody: text("hunt_body").notNull(),
    baseExp: integer("base_exp").notNull(),
    moneyMin: doublePrecision("money_min").notNull(),
    moneyMax: doublePrecision("money_max").notNull(),
    lootDropCnt: integer("loot_drop_cnt").notNull(),
    lootBonusChance: doublePrecision("loot_bonus_chance").notNull(),
    lootBonusMin: integer("loot_bonus_min").notNull(),
    lootBonusMax: integer("loot_bonus_max").notNull(),
    lootNothingWeight: integer("loot_nothing_weight").notNull(),
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
    check("bots_base_exp_check", sql`${table.baseExp} >= 0`),
    check(
      "bots_money_check",
      sql`${table.moneyMin} >= 0 AND ${table.moneyMax} >= ${table.moneyMin}`,
    ),
    check("bots_loot_drop_cnt_check", sql`${table.lootDropCnt} >= 0`),
    check(
      "bots_loot_bonus_chance_check",
      sql`${table.lootBonusChance} >= 0 AND ${table.lootBonusChance} <= 1`,
    ),
    check(
      "bots_loot_bonus_check",
      sql`${table.lootBonusMin} >= 0 AND ${table.lootBonusMax} >= ${table.lootBonusMin}`,
    ),
    check("bots_loot_nothing_weight_check", sql`${table.lootNothingWeight} >= 0`),
  ],
);

export const botLootEntries = catalogSchema.table(
  "bot_loot_entries",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    botId: integer("bot_id").notNull(),
    artikulId: integer("artikul_id").notNull(),
    dropWeight: integer("drop_weight").notNull(),
    countMin: integer("count_min").notNull(),
    countMax: integer("count_max").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.botId, table.artikulId] }),
    foreignKey({
      columns: [table.releaseId, table.botId],
      foreignColumns: [bots.releaseId, bots.id],
      name: "bot_loot_entries_bot_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.releaseId, table.artikulId],
      foreignColumns: [artifacts.releaseId, artifacts.id],
      name: "bot_loot_entries_artifact_fk",
    }).onDelete("restrict"),
    check("bot_loot_entries_drop_weight_check", sql`${table.dropWeight} >= 0`),
    check("bot_loot_entries_count_min_check", sql`${table.countMin} >= 1`),
    check("bot_loot_entries_count_max_check", sql`${table.countMax} >= ${table.countMin}`),
  ],
);

export const skillDefinitions = catalogSchema.table(
  "skill_definitions",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    id: text("id").notNull(),
    title: text("title").notNull(),
    groupKey: text("group_key").notNull(),
    sortOrder: text("sort_order").notNull(),
    weight: text("weight").notNull(),
    image: text("image").notNull(),
    valueKind: text("value_kind").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.id] }),
    check("skill_definitions_value_kind_check", sql`${table.valueKind} IN ('number', 'string')`),
  ],
);

export const levelBoundaries = catalogSchema.table(
  "level_boundaries",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    level: integer("level").notNull(),
    expMin: integer("exp_min").notNull(),
    expMax: integer("exp_max").notNull(),
    bagCnt: integer("bag_cnt").notNull(),
    honorRank: integer("honor_rank").notNull(),
    honorMin: integer("honor_min").notNull(),
    honorMax: integer("honor_max").notNull(),
    honorStatus: integer("honor_status").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.level] }),
    check("level_boundaries_level_check", sql`${table.level} > 0`),
    check(
      "level_boundaries_exp_check",
      sql`${table.expMin} >= 0 AND ${table.expMax} > ${table.expMin}`,
    ),
    check("level_boundaries_bag_cnt_check", sql`${table.bagCnt} > 0`),
    check(
      "level_boundaries_honor_check",
      sql`${table.honorRank} >= 0 AND ${table.honorMin} >= 0 AND ${table.honorMax} >= ${table.honorMin} AND ${table.honorStatus} >= 0`,
    ),
  ],
);

export const levelSkillValues = catalogSchema.table(
  "level_skill_values",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    level: integer("level").notNull(),
    skillId: text("skill_id").notNull(),
    value: integer("value").notNull(),
    evidenceKind: text("evidence_kind").notNull(),
    sourceDigest: text("source_digest").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.level, table.skillId] }),
    foreignKey({
      columns: [table.releaseId, table.level],
      foreignColumns: [levelBoundaries.releaseId, levelBoundaries.level],
      name: "level_skill_values_boundary_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.releaseId, table.skillId],
      foreignColumns: [skillDefinitions.releaseId, skillDefinitions.id],
      name: "level_skill_values_skill_fk",
    }).onDelete("restrict"),
    check("level_skill_values_value_check", sql`${table.value} >= 0`),
    check(
      "level_skill_values_evidence_kind_check",
      sql`${table.evidenceKind} IN ('confirmed', 'legacy_extrapolated')`,
    ),
    check("level_skill_values_source_digest_check", sql`char_length(${table.sourceDigest}) = 64`),
  ],
);

export const appearancePresets = catalogSchema.table(
  "appearance_presets",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    kind: integer("kind").notNull(),
    gender: integer("gender").notNull(),
    avatarBig: text("avatar_big").notNull(),
    avatarSmall: text("avatar_small").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.kind, table.gender] }),
    check("appearance_presets_kind_check", sql`${table.kind} > 0`),
    check("appearance_presets_gender_check", sql`${table.gender} > 0`),
  ],
);

export const gameWideDocuments = catalogSchema.table(
  "game_wide_documents",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    documentKey: text("document_key").notNull(),
    document: jsonb("document").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.documentKey] }),
    check(
      "game_wide_documents_key_check",
      sql`${table.documentKey} IN ('hud_defaults', 'chrome', 'common_conf', 'welcome_message')`,
    ),
  ],
);

export const storeTypes = catalogSchema.table(
  "store_types",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    areaId: text("area_id").notNull(),
    typeId: integer("type_id").notNull(),
    title: text("title").notNull(),
    ord: integer("ord").notNull(),
  },
  (table) => [primaryKey({ columns: [table.releaseId, table.areaId, table.typeId] })],
);

export const storeLots = catalogSchema.table(
  "store_lots",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    areaId: text("area_id").notNull(),
    lotId: integer("lot_id").notNull(),
    artikulId: integer("artikul_id").notNull(),
    typeId: integer("type_id").notNull(),
    price: integer("price").notNull(),
    ord: integer("ord").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.areaId, table.lotId] }),
    foreignKey({
      columns: [table.releaseId, table.artikulId],
      foreignColumns: [artifacts.releaseId, artifacts.id],
      name: "store_lots_artifact_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.releaseId, table.areaId, table.typeId],
      foreignColumns: [storeTypes.releaseId, storeTypes.areaId, storeTypes.typeId],
      name: "store_lots_type_fk",
    }).onDelete("restrict"),
    check("store_lots_artikul_id_check", sql`${table.artikulId} > 0`),
    check("store_lots_price_check", sql`${table.price} >= 0`),
  ],
);

export const reputationTracks = catalogSchema.table(
  "reputation_tracks",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    objectId: integer("object_id").notNull(),
    type: integer("type").notNull(),
    title: text("title").notNull(),
    image: text("image").notNull(),
    unlockFlag: text("unlock_flag").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.objectId] }),
    check(
      "reputation_tracks_object_id_check",
      sql`${table.objectId} > 0 AND ${table.objectId} <> 36`,
    ),
    check("reputation_tracks_type_check", sql`${table.type} = 2`),
  ],
);
