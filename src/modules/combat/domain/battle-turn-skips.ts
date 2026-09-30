import type { BattleEvent } from "./battle-event.ts";
import { spendStunTurn } from "./apply-stun.ts";
import type { BattleRules } from "./battle-rules.ts";
import { requireBattleHuman } from "./battle-lookups.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { enemySideCleared, fightCombatants } from "./melee-target.ts";
import { opposingTeam } from "./opposing-team.ts";
import { timeoutHumanTurn, type HumanTimeout } from "./timeout-human-turn.ts";

/** The turn timed out; an AFK fighter at the skip limit dies, and the fight ends if he was the last. */
export function timeoutBattleTurn(
  input: Readonly<{
    humans: readonly HumanFighter[];
    bots: readonly BotFighter[];
    rules: BattleRules;
    fightId: string;
    accountId: number;
    nowMs: number;
  }>,
): Readonly<{ timeout: HumanTimeout; finished: boolean }> | null {
  const human = requireBattleHuman(input.humans, input.accountId);
  const timeout = timeoutHumanTurn(human, input.nowMs, input.rules.maxConsecutiveSkips);
  if (!timeout) return null;
  if (!timeout.fell || !enemySideCleared(human.team, fightCombatants(input.humans, input.bots))) {
    return { timeout, finished: false };
  }
  const finished = {
    type: "finished" as const,
    winnerTeam: opposingTeam(human.team),
    fightId: input.fightId,
  };
  return { timeout: { events: [...timeout.events, finished], fell: true }, finished: true };
}

/** A stunned human loses this turn instead of receiving it; the events purge the stun icon. */
export function consumeStunSkip(human: HumanFighter): readonly BattleEvent[] | null {
  if (human.stunnedTurns < 1 || human.waiting || human.hp === 0) return null;
  return spendStunTurn(human);
}
