import type { BotSpellBook } from "../../catalog/domain/bot-spell-book.ts";
import type { HuntBotSpellBook } from "../../combat/domain/hunt-bot-spell-book.ts";
import { toCombatSpell } from "./to-combat-spell.ts";

export function huntBotSpellBookFromCatalog(book: BotSpellBook): HuntBotSpellBook {
  return {
    nothingWeight: book.nothingWeight,
    spells: book.spells.map((card) => ({
      artikulId: card.artikulId,
      slot: card.slot,
      weight: card.weight,
      maxCasts: card.maxCasts,
      gate: card.gate,
      hpPct: card.hpPct,
      spell: toCombatSpell(card.spell),
    })),
  };
}
