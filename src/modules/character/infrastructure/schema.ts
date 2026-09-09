import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { releases } from "../../content/infrastructure/schema.ts";

export const characterSchema = pgSchema("character");

export const heroes = characterSchema.table(
  "heroes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity({
      startWith: 1,
      minValue: 1,
      maxValue: 2_147_483_647,
      cycle: false,
    }),
    accountId: integer("account_id").notNull().unique(),
    nick: text("nick").notNull(),
    level: integer("level").notNull(),
    hp: integer("hp").notNull(),
    maxHp: integer("max_hp").notNull(),
    mp: integer("mp").notNull(),
    maxMp: integer("max_mp").notNull(),
    exp: integer("exp").notNull(),
    areaId: text("area_id").notNull(),
    moneyMinor: bigint("money_minor", { mode: "bigint" }).notNull(),
    moneyGoldMinor: bigint("money_gold_minor", { mode: "bigint" }).notNull(),
    kind: integer("kind").notNull(),
    gender: integer("gender").notNull(),
    language: text("language").notNull(),
    body: text("body").notNull(),
    sk: integer("sk").notNull(),
    honor: integer("honor").notNull(),
    hpTime: bigint("hp_time", { mode: "bigint" }).notNull(),
    regenAt: timestamp("regen_at", { withTimezone: true, mode: "date" }).notNull(),
    moveReadyAt: timestamp("move_ready_at", { withTimezone: true, mode: "date" }),
    ghost: boolean("ghost").notNull().default(false),
    injuryTime: bigint("injury_time", { mode: "bigint" }).notNull().default(0n),
    injuryArtikulId: integer("injury_artikul_id").notNull().default(0),
    version: integer("version").notNull(),
  },
  (table) => [
    check("heroes_level_check", sql`${table.level} > 0`),
    check("heroes_hp_check", sql`${table.hp} >= 0`),
    check("heroes_max_hp_check", sql`${table.maxHp} > 0 AND ${table.hp} <= ${table.maxHp}`),
    check("heroes_mp_check", sql`${table.mp} >= 0`),
    check("heroes_max_mp_check", sql`${table.maxMp} > 0 AND ${table.mp} <= ${table.maxMp}`),
    check("heroes_exp_check", sql`${table.exp} >= 0`),
    check("heroes_money_minor_check", sql`${table.moneyMinor} >= 0`),
    check("heroes_money_gold_minor_check", sql`${table.moneyGoldMinor} >= 0`),
    check("heroes_kind_check", sql`${table.kind} > 0`),
    check("heroes_gender_check", sql`${table.gender} > 0`),
    check("heroes_sk_check", sql`${table.sk} >= 0`),
    check("heroes_honor_check", sql`${table.honor} >= 0`),
    check("heroes_hp_time_check", sql`${table.hpTime} >= 0`),
    check("heroes_injury_time_check", sql`${table.injuryTime} >= 0`),
    check("heroes_injury_artikul_id_check", sql`${table.injuryArtikulId} >= 0`),
    check("heroes_version_check", sql`${table.version} > 0`),
  ],
);

export const heroPersonalDetails = characterSchema.table(
  "hero_personal_details",
  {
    heroId: integer("hero_id")
      .primaryKey()
      .references(() => heroes.id, { onDelete: "cascade" }),
    info: jsonb("info").$type<Record<string, unknown>>().notNull(),
    schemaVersion: integer("schema_version").notNull(),
  },
  (table) => [
    check("hero_personal_details_schema_version_check", sql`${table.schemaVersion} = 1`),
    check("hero_personal_details_info_object_check", sql`jsonb_typeof(${table.info}) = 'object'`),
    check("hero_personal_details_info_size_check", sql`octet_length(${table.info}::text) <= 16384`),
  ],
);

export const experienceGrants = characterSchema.table(
  "experience_grants",
  {
    heroId: integer("hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "cascade" }),
    operationId: text("operation_id").notNull(),
    amount: integer("amount").notNull(),
    expBefore: integer("exp_before").notNull(),
    expAfter: integer("exp_after").notNull(),
    levelBefore: integer("level_before").notNull(),
    levelAfter: integer("level_after").notNull(),
    contentReleaseId: uuid("content_release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    progressionDigest: text("progression_digest").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.heroId, table.operationId] }),
    check(
      "experience_grants_operation_id_check",
      sql`char_length(${table.operationId}) BETWEEN 1 AND 128`,
    ),
    check("experience_grants_amount_check", sql`${table.amount} > 0`),
    check("experience_grants_exp_before_check", sql`${table.expBefore} >= 0`),
    check("experience_grants_exp_after_check", sql`${table.expAfter} >= ${table.expBefore}`),
    check("experience_grants_level_before_check", sql`${table.levelBefore} > 0`),
    check("experience_grants_level_after_check", sql`${table.levelAfter} >= ${table.levelBefore}`),
    check(
      "experience_grants_progression_digest_check",
      sql`char_length(${table.progressionDigest}) = 64`,
    ),
  ],
);

export const heroSkills = characterSchema.table(
  "hero_skills",
  {
    heroId: integer("hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "cascade" }),
    skillId: text("skill_id").notNull(),
    value: integer("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.heroId, table.skillId] }),
    check("hero_skills_value_check", sql`${table.value} >= 0`),
  ],
);

export const heroReputations = characterSchema.table(
  "hero_reputations",
  {
    heroId: integer("hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "cascade" }),
    objectId: integer("object_id").notNull(),
    value: integer("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.heroId, table.objectId] }),
    check(
      "hero_reputations_object_id_check",
      sql`${table.objectId} > 0 AND ${table.objectId} <> 36`,
    ),
    check("hero_reputations_value_check", sql`${table.value} >= 0`),
  ],
);
