import type { BotFighter } from "./bot-fighter.ts";
import type { Fighter } from "./fighter.ts";

/**
 * What an AI actor may look at when it decides: itself and the foe in its duel, never the
 * battle. `casts` is the actor's own cast ledger, the one piece of state a brain advances.
 */
export type CombatSnapshot = Readonly<{
  selfHp: number;
  selfMaxHp: number;
  foeStandingGroups: readonly number[];
  /** The foe is stunned now: a stun would not add anything. */
  foeStunned: boolean;
  casts: Map<number, number>;
}>;

export function snapshotForBot(self: BotFighter, foe: Fighter): CombatSnapshot {
  return {
    selfHp: self.hp,
    selfMaxHp: self.maxHp,
    foeStandingGroups: foe.effects.standingGroups(),
    foeStunned: foe.stunnedTurns > 0,
    casts: self.casts,
  };
}
