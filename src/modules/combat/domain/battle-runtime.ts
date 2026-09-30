import type { BattleEvent } from "./battle-event.ts";
import { humanOpponentNew, livingWaiterOnTeam } from "./battle-pairing.ts";
import { dissolveDuelContaining } from "./pairing.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { takeNextEnemyForHuman } from "./wait-queue.ts";
import type { PlayerMeleeResult } from "./paired-melee.ts";
import { retargetDuelTo } from "./retarget-duel.ts";

export function settleAfterPlayerHit(
  resolved: Readonly<{
    result: PlayerMeleeResult;
    finished: boolean;
  }>,
  input: Readonly<{
    bots: readonly BotFighter[];
    enemyTeam: 1 | 2;
    duel: FightDuel;
    duels: FightDuel[];
    opener: HumanFighter;
    humans: readonly HumanFighter[];
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
    bots: readonly BotFighter[];
    enemyTeam: 1 | 2;
    duel: FightDuel;
    duels: FightDuel[];
    opener: HumanFighter;
    humans: readonly HumanFighter[];
  }>,
): Readonly<{ events: readonly BattleEvent[]; finished: boolean }> {
  if (finished) return { events: [], finished: true };
  const hitBot = input.bots.find((bot) => bot.fightId === input.duel.otherId(input.opener.heroId));
  if (!hitBot || hitBot.hp > 0) return { events: [], finished: false };
  const next = takeNextEnemyForHuman({
    bots: input.bots,
    enemyTeam: input.enemyTeam,
    duels: input.duels,
    occupiedFightId: hitBot.fightId,
  });
  if (next) {
    input.duel.replace(hitBot.fightId, next.fightId);
    input.duel.resetHits();
    input.duel.setNextActor(input.opener.heroId);
    return { events: [{ type: "opponent-new", bot: next.snap() }], finished: false };
  }
  const intervenor = livingWaiterOnTeam(input.humans, hitBot.team);
  if (!intervenor) {
    dissolveDuelContaining(input.duels, [...input.humans, ...input.bots], hitBot.fightId);
    return { events: [{ type: "opponent-wait" }], finished: false };
  }
  retargetDuelTo({ duel: input.duel, fromHeroId: hitBot.fightId, waiter: intervenor });
  return { events: [humanOpponentNew(intervenor)], finished: false };
}
