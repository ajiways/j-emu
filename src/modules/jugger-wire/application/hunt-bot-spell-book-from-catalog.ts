import type { BotSpellBook } from "../../catalog/domain/bot-spell-book.ts";
import type {
  HuntBotSpellBook,
  HuntBotSpellCard,
} from "../../combat/domain/hunt-bot-spell-book.ts";
import { toCombatSpell } from "./to-combat-spell.ts";

export type BotSpellArtikulIdentity = Readonly<{
  artifact(id: number): Promise<Readonly<{ title: string; picture: string }> | null>;
}>;

export async function huntBotSpellBookFromCatalog(
  book: BotSpellBook,
  catalog: BotSpellArtikulIdentity,
): Promise<HuntBotSpellBook> {
  const spells: HuntBotSpellCard[] = [];
  for (const card of book.spells) {
    const artifact = await catalog.artifact(card.artikulId);
    if (!artifact) {
      throw new Error(`Bot spell ${card.artikulId} artifact is missing`);
    }
    if (!artifact.title) {
      throw new Error(`Bot spell ${card.artikulId} title is required`);
    }
    if (!artifact.picture) {
      throw new Error(`Bot spell ${card.artikulId} picture is required`);
    }
    spells.push({
      artikulId: card.artikulId,
      title: artifact.title,
      picture: artifact.picture,
      slot: card.slot,
      weight: card.weight,
      maxCasts: card.maxCasts,
      gate: card.gate,
      hpPct: card.hpPct,
      spell: toCombatSpell(card.spell),
    });
  }
  return { nothingWeight: book.nothingWeight, spells };
}
