import { sql } from "drizzle-orm";
import { check, foreignKey, integer, jsonb, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { releases } from "../../content/infrastructure/schema.ts";
import { bots, catalogSchema } from "./schema.ts";

export const botSpellBooks = catalogSchema.table(
  "bot_spell_books",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    botId: integer("bot_id").notNull(),
    nothingWeight: integer("nothing_weight").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.botId] }),
    foreignKey({
      columns: [table.releaseId, table.botId],
      foreignColumns: [bots.releaseId, bots.id],
      name: "bot_spell_books_bot_fk",
    }).onDelete("restrict"),
    check("bot_spell_books_nothing_weight_check", sql`${table.nothingWeight} >= 0`),
  ],
);

export const botSpellBookSpells = catalogSchema.table(
  "bot_spell_book_spells",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
    botId: integer("bot_id").notNull(),
    ord: integer("ord").notNull(),
    artikulId: integer("artikul_id").notNull(),
    slot: text("slot").notNull(),
    weight: integer("weight").notNull(),
    maxCasts: integer("max_casts"),
    gate: text("gate"),
    hpPct: integer("hp_pct"),
    spell: jsonb("spell").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.botId, table.artikulId] }),
    foreignKey({
      columns: [table.releaseId, table.botId],
      foreignColumns: [botSpellBooks.releaseId, botSpellBooks.botId],
      name: "bot_spell_book_spells_book_fk",
    }).onDelete("restrict"),
    check(
      "bot_spell_book_spells_slot_check",
      sql`${table.slot} IN ('fight_start', 'prefer', 'turn_roulette', 'never')`,
    ),
    check("bot_spell_book_spells_ord_check", sql`${table.ord} >= 0`),
    check("bot_spell_book_spells_weight_check", sql`${table.weight} >= 0`),
    check(
      "bot_spell_book_spells_max_casts_check",
      sql`${table.maxCasts} IS NULL OR ${table.maxCasts} >= 1`,
    ),
    check(
      "bot_spell_book_spells_gate_check",
      sql`${table.gate} IS NULL OR ${table.gate} = 'self_hp_le'`,
    ),
    check(
      "bot_spell_book_spells_hp_pct_check",
      sql`${table.hpPct} IS NULL OR (${table.hpPct} >= 1 AND ${table.hpPct} <= 100)`,
    ),
  ],
);
