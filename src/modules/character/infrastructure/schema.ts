import { sql } from "drizzle-orm";
import { bigint, check, integer, jsonb, pgSchema, text } from "drizzle-orm/pg-core";

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
    areaId: text("area_id").notNull(),
    moneyMinor: bigint("money_minor", { mode: "bigint" }).notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    check("heroes_level_check", sql`${table.level} > 0`),
    check("heroes_hp_check", sql`${table.hp} >= 0`),
    check("heroes_max_hp_check", sql`${table.maxHp} > 0 AND ${table.hp} <= ${table.maxHp}`),
    check("heroes_money_minor_check", sql`${table.moneyMinor} >= 0`),
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
