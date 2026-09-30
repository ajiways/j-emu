import type { BotBrain, BotDecision } from "./bot-brain.ts";
import type { CombatSnapshot } from "./combat-snapshot.ts";
import type { HuntBotSpellBook } from "./hunt-bot-spell-book.ts";
import { noteCast, pickBotSpell } from "./pick-bot-spell.ts";
import type { RandomSource } from "./random-source.ts";

/** The catalog spell book as a brain: fight-start, prefer, then weighted roulette. */
export class SpellBookBotBrain implements BotBrain {
  /** How many times this brain has cast each spell: what `maxCasts` and `once` count. */
  private readonly casts = new Map<number, number>();

  constructor(private readonly book: HuntBotSpellBook) {}

  decide(snapshot: CombatSnapshot, random: RandomSource): BotDecision {
    const card = pickBotSpell(
      this.book,
      {
        botHp: snapshot.selfHp,
        botMaxHp: snapshot.selfMaxHp,
        casts: this.casts,
        foeGroups: snapshot.foeStandingGroups,
        foeStunned: snapshot.foeStunned,
      },
      random,
    );
    if (!card) return { kind: "melee" };
    noteCast(this.casts, card.artikulId);
    return { kind: "cast", card };
  }
}
