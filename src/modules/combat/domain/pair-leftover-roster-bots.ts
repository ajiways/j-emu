import { FightDuel } from "./fight-duel.ts";
import type { HuntRoster } from "./hunt-roster.ts";

/**
 * Quest leftover ally/enemy pairing at seed. Opener is always the ally;
 * there is no `rollOpensFirst` (legacy constructor path).
 */
export function pairLeftoverRosterBots(roster: HuntRoster): FightDuel[] {
  const leftoverEnemies = roster
    .allBots()
    .filter((bot) => bot.waiting && bot.team === roster.enemyTeam);
  const leftoverAllies = roster
    .allBots()
    .filter((bot) => bot.waiting && bot.team === roster.openerTeam);
  const duels: FightDuel[] = [];
  while (leftoverEnemies.length > 0 && leftoverAllies.length > 0) {
    const enemy = leftoverEnemies.shift();
    const ally = leftoverAllies.shift();
    if (!enemy || !ally) throw new Error("Quest roster pairing is missing a bot");
    ally.pair();
    enemy.pair();
    duels.push(new FightDuel(ally.fightId, enemy.fightId, ally.fightId));
  }
  return duels;
}
