import { and, asc, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { BotDocument } from "../../content/domain/content-document.ts";
import { artifactExtraFromJson } from "./artifact-extra-from-json.ts";
import { BotSpellBook, type BotSpellCard } from "../domain/bot-spell-book.ts";
import { botSpellBookSpells, botSpellBooks } from "./schema-bot-spell-book.ts";

type Session = ReturnType<PostgresDatabase["session"]>;

export async function insertBotSpellBooks(
  session: Session,
  releaseId: string,
  rows: readonly BotDocument[],
): Promise<void> {
  if (rows.length === 0) return;
  const books = rows.map((bot) => ({
    releaseId,
    botId: bot.id,
    nothingWeight: bot.spellBook.nothingWeight,
  }));
  await insertInBatches(books, async (batch) => {
    await session.insert(botSpellBooks).values(batch);
  });
  const spells = rows.flatMap((bot) =>
    bot.spellBook.spells.map((card, ord) => ({
      releaseId,
      botId: bot.id,
      ord,
      artikulId: card.artikulId,
      slot: card.slot,
      weight: card.weight,
      maxCasts: card.maxCasts,
      gate: card.gate,
      hpPct: card.hpPct,
      spell: card.spell,
    })),
  );
  if (spells.length > 0) {
    await insertInBatches(spells, async (batch) => {
      await session.insert(botSpellBookSpells).values(batch);
    });
  }
}

export async function loadBotSpellBook(
  session: Session,
  releaseId: string,
  botId: number,
): Promise<BotSpellBook> {
  const books = await session
    .select()
    .from(botSpellBooks)
    .where(and(eq(botSpellBooks.releaseId, releaseId), eq(botSpellBooks.botId, botId)));
  if (books.length > 1) throw new Error(`Multiple bot spell books found for ${botId}`);
  const book = books[0];
  if (!book) throw new Error(`Bot ${botId} is missing a spell book in the active catalog release`);
  const spellRows = await session
    .select()
    .from(botSpellBookSpells)
    .where(and(eq(botSpellBookSpells.releaseId, releaseId), eq(botSpellBookSpells.botId, botId)))
    .orderBy(asc(botSpellBookSpells.ord));
  return new BotSpellBook(
    book.nothingWeight,
    spellRows.map((row) => spellCardFromRow(botId, row)),
  );
}

function spellCardFromRow(
  botId: number,
  row: typeof botSpellBookSpells.$inferSelect,
): BotSpellCard {
  const extra = artifactExtraFromJson(row.artikulId, { spell: row.spell });
  if (!extra.spell) {
    throw new Error(`Bot ${botId} spell ${row.artikulId} extra.spell is missing`);
  }
  if (
    row.slot !== "fight_start" &&
    row.slot !== "prefer" &&
    row.slot !== "turn_roulette" &&
    row.slot !== "never"
  ) {
    throw new Error(`Bot ${botId} spell ${row.artikulId} slot is invalid`);
  }
  if (
    row.gate !== null &&
    row.gate !== "self_hp_le" &&
    row.gate !== "once" &&
    row.gate !== "foe_has_dispel_groups"
  ) {
    throw new Error(`Bot ${botId} spell ${row.artikulId} gate is not supported`);
  }
  return {
    artikulId: row.artikulId,
    slot: row.slot,
    weight: row.weight,
    maxCasts: row.maxCasts,
    gate: row.gate,
    hpPct: row.hpPct,
    spell: extra.spell,
  };
}

const INSERT_BATCH = 250;

async function insertInBatches<T>(
  rows: readonly T[],
  write: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += INSERT_BATCH) {
    await write(rows.slice(offset, offset + INSERT_BATCH));
  }
}
