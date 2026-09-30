import type { CombatSnapshot } from "./combat-snapshot.ts";
import type { MobSpellCard } from "./mob-spell-book.ts";
import type { RandomSource } from "./random-source.ts";

export type BotDecision =
  Readonly<{ kind: "cast"; card: MobSpellCard }> | Readonly<{ kind: "melee" }>;

/** Chooses a bot's action for its turn; the resolver carries it out. */
export interface BotBrain {
  decide(snapshot: CombatSnapshot, random: RandomSource): BotDecision;
}
