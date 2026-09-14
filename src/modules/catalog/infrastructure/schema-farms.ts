import { sql } from "drizzle-orm";
import { check, integer, pgSchema, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { releases } from "../../content/infrastructure/schema.ts";

const catalogSchema = pgSchema("catalog");

export const assistantTypes = catalogSchema.table(
  "assistant_types",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    id: integer("id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    profession: integer("profession").notNull(),
    level: integer("level").notNull(),
    quality: integer("quality").notNull(),
    nextArtikulId: integer("next_artikul_id").notNull(),
    skillSum: integer("skill_sum").notNull(),
    price: integer("price").notNull(),
    priceType: integer("price_type").notNull(),
    picture: text("picture").notNull(),
    restrictionsXml: text("restrictions_xml").notNull(),
    voodooEnergy: integer("voodoo_energy").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.id] }),
    check("assistant_types_id_check", sql`${table.id} > 0`),
    check(
      "assistant_types_profession_check",
      sql`${table.profession} >= 1 AND ${table.profession} <= 16`,
    ),
    check("assistant_types_level_check", sql`${table.level} > 0`),
    check("assistant_types_quality_check", sql`${table.quality} >= 0`),
    check("assistant_types_next_artikul_id_check", sql`${table.nextArtikulId} >= 0`),
    check("assistant_types_skill_sum_check", sql`${table.skillSum} > 0`),
    check("assistant_types_price_check", sql`${table.price} >= 0`),
    check("assistant_types_price_type_check", sql`${table.priceType} > 0`),
    check("assistant_types_voodoo_energy_check", sql`${table.voodooEnergy} >= 0`),
  ],
);

export const farmResources = catalogSchema.table(
  "farm_resources",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    id: integer("id").notNull(),
    title: text("title").notNull(),
    typeId: integer("type_id").notNull(),
    picture: text("picture").notNull(),
    swf: text("swf").notNull(),
    quality: integer("quality").notNull(),
    profession: integer("profession").notNull(),
    artifactArtikulId: integer("artifact_artikul_id").notNull(),
    masteryValue: integer("mastery_value").notNull(),
    masteryMax: integer("mastery_max").notNull(),
    farmTime: integer("farm_time").notNull(),
    staminaDrain: integer("stamina_drain").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.id] }),
    check("farm_resources_id_check", sql`${table.id} > 0`),
    check("farm_resources_type_id_check", sql`${table.typeId} >= 0`),
    check("farm_resources_quality_check", sql`${table.quality} >= 0`),
    check(
      "farm_resources_profession_check",
      sql`${table.profession} >= 0 AND ${table.profession} <= 16`,
    ),
    check("farm_resources_artifact_artikul_id_check", sql`${table.artifactArtikulId} > 0`),
    check("farm_resources_mastery_value_check", sql`${table.masteryValue} >= 0`),
    check("farm_resources_mastery_max_check", sql`${table.masteryMax} > 0`),
    check("farm_resources_farm_time_check", sql`${table.farmTime} > 0`),
    check("farm_resources_stamina_drain_check", sql`${table.staminaDrain} > 0`),
  ],
);

export const areaFarms = catalogSchema.table(
  "area_farms",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    areaId: text("area_id").notNull(),
    huntSpotId: integer("hunt_spot_id").notNull(),
    farmId: integer("farm_id").notNull(),
    tactics: integer("tactics").notNull(),
    assistantMax: integer("assistant_max").notNull(),
    cntMax: integer("cnt_max").notNull(),
    cntCooldown: integer("cnt_cooldown").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.areaId, table.huntSpotId] }),
    check("area_farms_hunt_spot_id_check", sql`${table.huntSpotId} > 0`),
    check("area_farms_farm_id_check", sql`${table.farmId} > 0`),
    check("area_farms_tactics_check", sql`${table.tactics} >= 0 AND ${table.tactics} <= 2`),
    check("area_farms_assistant_max_check", sql`${table.assistantMax} > 0`),
    check("area_farms_cnt_max_check", sql`${table.cntMax} > 0`),
    check("area_farms_cnt_cooldown_check", sql`${table.cntCooldown} >= 0`),
  ],
);
