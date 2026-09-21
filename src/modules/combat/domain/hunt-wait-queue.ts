import type { FightDuel } from "./fight-duel.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import { botMeleeTarget } from "./melee-target.ts";
import { dissolveDuelAt } from "./try-pair-hunt-queues.ts";

export function peekWaitingEnemy(
  bots: readonly HuntRosterBot[],
  enemyTeam: 1 | 2,
): HuntRosterBot | null {
  return (
    bots.find((bot) => bot.waiting && bot.team === enemyTeam && botMeleeTarget(bot).alive) ?? null
  );
}

export function takeNextEnemyForHuman(
  input: Readonly<{
    bots: readonly HuntRosterBot[];
    enemyTeam: 1 | 2;
    duels: FightDuel[];
    occupiedFightId: number;
  }>,
): HuntRosterBot | null {
  const waiting = peekWaitingEnemy(input.bots, input.enemyTeam);
  if (waiting) {
    waiting.pair();
    return waiting;
  }
  for (let index = input.duels.length - 1; index >= 0; index -= 1) {
    const duel = input.duels[index];
    if (!duel) throw new Error("Battle duel slot is empty");
    const enemy = livingEnemyInBotDuel(duel, input.bots, input.enemyTeam);
    if (!enemy || enemy.fightId === input.occupiedFightId) continue;
    dissolveDuelAt(input.duels, index, [], input.bots, enemy.fightId);
    return enemy;
  }
  return null;
}

function livingEnemyInBotDuel(
  duel: FightDuel,
  bots: readonly HuntRosterBot[],
  enemyTeam: 1 | 2,
): HuntRosterBot | null {
  const a = bots.find((bot) => bot.fightId === duel.aId);
  const b = bots.find((bot) => bot.fightId === duel.bId);
  if (!a || !b) return null;
  for (const bot of [a, b]) {
    if (bot.team === enemyTeam && botMeleeTarget(bot).alive) return bot;
  }
  return null;
}
