import type { BotBrain, BotDecision } from "./bot-brain.ts";
import type { CombatSnapshot } from "./combat-snapshot.ts";
import type { HuntBotSpellBook } from "./hunt-bot-spell-book.ts";
import { noteCast, pickBotSpell } from "./pick-bot-spell.ts";
import type { RandomSource } from "./random-source.ts";

/** The catalog spell book as a brain: fight-start, prefer, then weighted roulette. */
export class SpellBookBotBrain implements BotBrain {
  constructor(private readonly book: HuntBotSpellBook) {}

  decide(snapshot: CombatSnapshot, random: RandomSource): BotDecision {
    const card = pickBotSpell(
      this.book,
      {
        botHp: snapshot.selfHp,
        botMaxHp: snapshot.selfMaxHp,
        casts: snapshot.casts,
        foeGroups: snapshot.foeStandingGroups,
      },
      random,
    );
    if (!card) return { kind: "melee" };
    noteCast(snapshot.casts, card.artikulId);
    return { kind: "cast", card };
  }
}
