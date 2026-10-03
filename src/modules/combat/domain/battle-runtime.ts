import type { RandomSource } from "./random-source.ts";
import type { Roster } from "./roster.ts";
import type { BattleEvent } from "./battle-event.ts";
import { replaceFallen } from "./duel-shuffle.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { PlayerMeleeResult } from "./paired-melee.ts";

export function settleAfterPlayerHit(
  resolved: Readonly<{
    result: PlayerMeleeResult;
    finished: boolean;
  }>,
  input: Readonly<{
    roster: Roster;
    duel: FightDuel;
    duels: FightDuel[];
    opener: HumanFighter;
    openingRandom: RandomSource;
  }>,
): Readonly<{ result: PlayerMeleeResult; finished: boolean }> {
  if (resolved.result.kind !== "resolved" || resolved.result.selfKilled) {
    return { result: resolved.result, finished: resolved.finished };
  }
  const extra = settleAfterMobFell(resolved.finished, input);
  if (extra.events.length === 0) {
    return { result: resolved.result, finished: extra.finished };
  }
  return {
    result: { ...resolved.result, events: [...resolved.result.events, ...extra.events] },
    finished: extra.finished,
  };
}

/**
 * A mob of the opener's duel has fallen: the same rule as for any fallen participant gives him
 * the next foe (see `replaceFallen`); what the opener is told about it comes back as events.
 * A fallen player is handed off by the application, which also has his stream to close.
 */
export function settleAfterMobFell(
  finished: boolean,
  input: Readonly<{
    roster: Roster;
    duel: FightDuel;
    duels: FightDuel[];
    opener: HumanFighter;
    /** Rolls who strikes first against the next foe (the same roll as for a new pair). */
    openingRandom: RandomSource;
  }>,
): Readonly<{ events: readonly BattleEvent[]; finished: boolean }> {
  if (finished) return { events: [], finished: true };
  const hitBot = input.roster.bots.find(
    (bot) => bot.fightId === input.duel.otherId(input.opener.heroId),
  );
  if (!hitBot || hitBot.hp > 0) return { events: [], finished: false };
  const outcome = replaceFallen({
    dead: hitBot,
    humans: input.roster.humans,
    bots: input.roster.bots,
    duels: input.duels,
    openingRandom: input.openingRandom,
  });
  const told = outcome?.tells.find((entry) => entry.accountId === input.opener.accountId);
  return { events: told?.events ?? [], finished: false };
}
