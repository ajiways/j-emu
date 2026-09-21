import type { FightDuel } from "./fight-duel.ts";
import type { HuntRoster } from "./hunt-roster.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import { botMeleeTarget } from "./melee-target.ts";
import { dissolveDuelAt } from "./try-pair-hunt-queues.ts";

export function peekWaitingEnemy(roster: HuntRoster): HuntRosterBot | null {
  return (
    roster
      .allBots()
      .find((bot) => bot.waiting && bot.team === roster.enemyTeam && botMeleeTarget(bot).alive) ??
    null
  );
}

export function takeNextEnemyForHuman(
  input: Readonly<{
    roster: HuntRoster;
    duels: FightDuel[];
    occupiedFightId: number;
  }>,
): HuntRosterBot | null {
  const waiting = peekWaitingEnemy(input.roster);
  if (waiting) {
    waiting.pair();
    return waiting;
  }
  for (let index = input.duels.length - 1; index >= 0; index -= 1) {
    const duel = input.duels[index];
    if (!duel) throw new Error("Battle duel slot is empty");
    const enemy = livingEnemyInBotDuel(duel, input.roster);
    if (!enemy || enemy.fightId === input.occupiedFightId) continue;
    dissolveDuelAt(input.duels, index, [], input.roster, enemy.fightId);
    return enemy;
  }
  return null;
}

function livingEnemyInBotDuel(duel: FightDuel, roster: HuntRoster): HuntRosterBot | null {
  const a = roster.findBot(duel.aId);
  const b = roster.findBot(duel.bId);
  if (!a || !b) return null;
  for (const bot of [a, b]) {
    if (bot.team === roster.enemyTeam && botMeleeTarget(bot).alive) return bot;
  }
  return null;
}
