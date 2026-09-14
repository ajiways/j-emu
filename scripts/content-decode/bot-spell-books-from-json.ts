import { amfInteger, amfOmittedZeroInteger, isRecord } from "./amf-fields.ts";
import { EMPTY_BOT_SPELL_NOTHING_WEIGHT } from "./hunt-look-policy.ts";

const SLOTS = new Set(["fight_start", "prefer", "turn_roulette", "never"]);

export type BotSpellBookDocument = Readonly<{
  botId: number;
  nothingWeight: number;
  spells: readonly BotSpellCardDocument[];
}>;

type BotSpellCardDocument = Readonly<{
  artikulId: number;
  slot: "fight_start" | "prefer" | "turn_roulette" | "never";
  weight: number;
  maxCasts: number | null;
  gate: "self_hp_le" | "once" | "foe_has_dispel_groups" | null;
  hpPct: number | null;
  spell: Readonly<Record<string, unknown>>;
}>;

export function spellBooksFromJson(
  decoded: unknown,
  botIds: ReadonlySet<number>,
  spellByArtikul: ReadonlyMap<number, Readonly<Record<string, unknown>>>,
): BotSpellBookDocument[] {
  if (!isRecord(decoded)) throw new Error("bot-spell-book.json root must be an object");
  const rows = decoded.bots;
  if (!Array.isArray(rows)) throw new Error("bot-spell-book.json bots array is required");
  const books: BotSpellBookDocument[] = [];
  const seen = new Set<number>();
  for (const raw of rows) {
    const book = bookFromRow(raw, spellByArtikul);
    if (seen.has(book.botId)) {
      throw new Error(`Duplicate bot id ${book.botId} in bot-spell-book.json`);
    }
    if (!botIds.has(book.botId)) {
      throw new Error(`bot-spell-book.json bot ${book.botId} is not in the bot corpus`);
    }
    seen.add(book.botId);
    books.push(book);
  }
  return books.sort((left, right) => left.botId - right.botId);
}

export function emptySpellBook(botId: number): BotSpellBookDocument {
  return { botId, nothingWeight: EMPTY_BOT_SPELL_NOTHING_WEIGHT, spells: [] };
}

function bookFromRow(
  raw: unknown,
  spellByArtikul: ReadonlyMap<number, Readonly<Record<string, unknown>>>,
): BotSpellBookDocument {
  if (!isRecord(raw)) throw new Error("bot-spell-book.json bot row must be an object");
  const botId = amfInteger(raw.botId, "bot-spell-book.json botId");
  if (botId < 1) throw new Error("bot-spell-book.json botId must be positive");
  const spellsIn = raw.spells;
  if (!Array.isArray(spellsIn))
    throw new Error(`bot-spell-book.json bot ${botId} spells is required`);
  const spells: BotSpellCardDocument[] = [];
  const seen = new Set<number>();
  for (const [index, card] of spellsIn.entries()) {
    const parsed = cardFromRow(botId, index, card, spellByArtikul);
    if (!parsed) continue;
    if (seen.has(parsed.artikulId)) {
      throw new Error(`bot ${botId} spellBook artikul ids must be unique`);
    }
    seen.add(parsed.artikulId);
    spells.push(parsed);
  }
  return {
    botId,
    nothingWeight: amfOmittedZeroInteger(
      raw.nothingWeight,
      `bot-spell-book.json bot ${botId} nothingWeight`,
    ),
    spells,
  };
}

function cardFromRow(
  botId: number,
  index: number,
  raw: unknown,
  spellByArtikul: ReadonlyMap<number, Readonly<Record<string, unknown>>>,
): BotSpellCardDocument | null {
  if (!isRecord(raw)) {
    throw new Error(`bot-spell-book.json bot ${botId} spell ${index} must be an object`);
  }
  const artikulId = amfOmittedZeroInteger(
    raw.artikulId,
    `bot-spell-book.json bot ${botId} spell ${index} artikulId`,
  );
  if (artikulId === 0) return null;
  if (artikulId < 1) {
    throw new Error(`bot-spell-book.json bot ${botId} spell ${index} artikulId is invalid`);
  }
  const slotRaw = raw.slot;
  if (typeof slotRaw !== "string" || !SLOTS.has(slotRaw)) {
    throw new Error(`bot-spell-book.json bot ${botId} spell ${artikulId} slot is invalid`);
  }
  const slot = slotRaw as BotSpellCardDocument["slot"];
  const gateRaw = raw.gate;
  const gate = parseGate(botId, artikulId, gateRaw);
  const hpPct =
    raw.hpPct === undefined || raw.hpPct === null
      ? null
      : amfInteger(raw.hpPct, `bot-spell-book.json bot ${botId} spell ${artikulId} hpPct`);
  if ((gate === "self_hp_le") !== (hpPct !== null)) {
    throw new Error(`bot-spell-book.json bot ${botId} spell ${artikulId} hpPct/gate mismatch`);
  }
  const spell = spellByArtikul.get(artikulId);
  if (!spell) {
    throw new Error(`bot ${botId} spell ${artikulId} has no extra.spell in the item corpus`);
  }
  const maxCastsRaw = raw.maxCasts;
  const maxCasts =
    maxCastsRaw === undefined || maxCastsRaw === null
      ? null
      : unlimitedIfZero(
          amfInteger(maxCastsRaw, `bot-spell-book.json bot ${botId} spell ${artikulId} maxCasts`),
        );
  return {
    artikulId,
    slot,
    weight: amfOmittedZeroInteger(
      raw.weight,
      `bot-spell-book.json bot ${botId} spell ${artikulId} weight`,
    ),
    maxCasts,
    gate,
    hpPct,
    spell,
  };
}

function parseGate(botId: number, artikulId: number, raw: unknown): BotSpellCardDocument["gate"] {
  if (raw === undefined || raw === null || raw === "") return null;
  if (raw === "self_hp_le" || raw === "once" || raw === "foe_has_dispel_groups") return raw;
  throw new Error(`bot-spell-book.json bot ${botId} spell ${artikulId} gate is not supported`);
}

/** Authored `maxCasts: 0` is unlimited, same as `jgr-emu` `Number || null`. */
function unlimitedIfZero(value: number): number | null {
  if (value < 0) throw new Error("maxCasts must be >= 0");
  return value === 0 ? null : value;
}
