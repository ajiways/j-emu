import type { CombatSnapshot } from "./combat-snapshot.ts";
import type { HuntBotSpellCard } from "./hunt-bot-spell-book.ts";
import type { RandomSource } from "./random-source.ts";

export type BotDecision =
  Readonly<{ kind: "cast"; card: HuntBotSpellCard }> | Readonly<{ kind: "melee" }>;

/** Chooses a bot's action for its turn; the resolver carries it out. */
export interface BotBrain {
  decide(snapshot: CombatSnapshot, random: RandomSource): BotDecision;
}
