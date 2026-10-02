import { rollOpensFirst } from "./roll-opens-first.ts";
import type { RandomSource } from "./random-source.ts";
import type { Roster } from "./roster.ts";
import type { BattleEvent } from "./battle-event.ts";
import { humanOpponentNew, livingWaiterOnTeam } from "./battle-pairing.ts";
import { dissolveDuelContaining } from "./pairing.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { HumanFighter } from "./human-fighter.ts";
import { takeNextEnemyForHuman } from "./wait-queue.ts";
import type { PlayerMeleeResult } from "./paired-melee.ts";
import { retargetDuelTo } from "./retarget-duel.ts";

export function settleAfterPlayerHit(
  resolved: Readonly<{
    result: PlayerMeleeResult;
    finished: boolean;
  }>,
  input: Readonly<{
    roster: Roster;
    enemyTeam: 1 | 2;
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

export function settleAfterMobFell(
  finished: boolean,
  input: Readonly<{
    roster: Roster;
    enemyTeam: 1 | 2;
    duel: FightDuel;
    duels: FightDuel[];
    opener: HumanFighter;
    /** Rolls who strikes first against the next mob (the same roll as for a new pair). */
    openingRandom: RandomSource;
  }>,
): Readonly<{ events: readonly BattleEvent[]; finished: boolean }> {
  if (finished) return { events: [], finished: true };
  const hitBot = input.roster.bots.find(
    (bot) => bot.fightId === input.duel.otherId(input.opener.heroId),
  );
  if (!hitBot || hitBot.hp > 0) return { events: [], finished: false };
  const next = takeNextEnemyForHuman({
    bots: input.roster.bots,
    enemyTeam: input.enemyTeam,
    duels: input.duels,
    occupiedFightId: hitBot.fightId,
  });
  if (next) {
    input.duel.replace(hitBot.fightId, next.fightId);
    input.duel.resetHits();
    const mobFirst = rollOpensFirst(
      next.currentInitiative,
      input.opener.currentInitiative,
      input.openingRandom,
    );
    input.duel.setNextActor(mobFirst ? next.fightId : input.opener.heroId);
    return { events: [{ type: "opponent-new", bot: next.snap() }], finished: false };
  }
  const intervenor = livingWaiterOnTeam(input.roster.humans, hitBot.team);
  if (!intervenor) {
    dissolveDuelContaining(input.duels, input.roster.all(), hitBot.fightId);
    return { events: [{ type: "opponent-wait" }], finished: false };
  }
  retargetDuelTo({
    duel: input.duel,
    fromHeroId: hitBot.fightId,
    waiter: intervenor,
    other: input.opener,
    openingRandom: input.openingRandom,
  });
  return { events: [humanOpponentNew(intervenor)], finished: false };
}
