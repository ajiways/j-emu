import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { huntHumanOppNew, livingWaiterOnTeam } from "./battle-pairing.ts";
import { dissolveDuelAt, dissolveDuelContaining } from "./try-pair-hunt-queues.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { takeNextEnemyForHuman } from "./hunt-wait-queue.ts";
import { enemySideCleared } from "./melee-target.ts";
import type { PlayerMeleeResult } from "./paired-melee.ts";
import type { RandomSource } from "./random-source.ts";
import { resolveAiActorTurn } from "./resolve-ai-actor-turn.ts";
import { retargetDuelTo } from "./retarget-duel.ts";

export function tickHuntRosterDuels(input: {
  bots: readonly BotFighter[];
  enemyTeam: 1 | 2;
  duels: FightDuel[];
  finished: boolean;
  opener: HumanFighter;
  humans: readonly HumanFighter[];
  fightId: string;
  rules: BattleRules;
  random: RandomSource;
  nowMs: number;
}): Readonly<{ events: readonly BattleEvent[]; finished: boolean }> {
  if (input.finished) return { events: [], finished: true };
  if (input.bots.length === 0) return { events: [], finished: false };
  const events: BattleEvent[] = [];
  for (let index = input.duels.length - 1; index >= 0; index -= 1) {
    const duel = input.duels[index];
    if (!duel) throw new Error("Battle duel slot is empty");
    const actor = input.bots.find((bot) => bot.fightId === duel.nextActorId);
    const target = actor
      ? input.bots.find((bot) => bot.fightId === duel.otherId(actor.fightId))
      : null;
    if (!actor || !target) continue;
    if (!actor.alive || !target.alive) {
      dissolveDuelAt(input.duels, index, [...input.humans, ...input.bots], null);
      continue;
    }
    events.push(
      ...resolveAiActorTurn({
        bot: actor,
        duel,
        humans: input.humans,
        bots: input.bots,
        rules: input.rules,
        random: input.random,
        fightId: input.fightId,
        keepFightOnKill: true,
        living: [],
        winnerTeam: 1,
        nowMs: input.nowMs,
      }).events,
    );
    if (!actor.alive || !target.alive) {
      dissolveDuelAt(input.duels, index, [...input.humans, ...input.bots], null);
    }
  }
  const combatants = [...input.humans, ...input.bots];
  if (enemySideCleared(input.opener.team, combatants)) {
    events.push({
      type: "finished",
      winnerTeam: input.enemyTeam,
      fightId: input.fightId,
    });
    return { events, finished: true };
  }
  if (enemySideCleared(input.enemyTeam, combatants)) {
    events.push({
      type: "finished",
      winnerTeam: input.opener.team,
      fightId: input.fightId,
    });
    return { events, finished: true };
  }
  return { events, finished: false };
}

export function applyHuntPlayerHit(
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
  const extra = applyHuntBotHit(resolved.finished, input);
  if (extra.events.length === 0) {
    return { result: resolved.result, finished: extra.finished };
  }
  return {
    result: { ...resolved.result, events: [...resolved.result.events, ...extra.events] },
    finished: extra.finished,
  };
}

export function applyHuntBotHit(
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
  return { events: [huntHumanOppNew(intervenor)], finished: false };
}
