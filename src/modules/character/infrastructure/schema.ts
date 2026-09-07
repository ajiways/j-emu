import { sql } from "drizzle-orm";
import { bigint, check, integer, pgSchema, text } from "drizzle-orm/pg-core";

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
