import { FightDuel } from "./fight-duel.ts";
import type { FightTeamAssignment } from "./fight-rules.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";

/**
 * Quest leftover ally/enemy pairing at seed. Opener is always the ally;
 * there is no `rollOpensFirst` (legacy constructor path).
 */
export function pairLeftoverRosterBots(
  bots: readonly HuntRosterBot[],
  teamAssignment: FightTeamAssignment,
): FightDuel[] {
  const leftoverEnemies = bots.filter(
    (bot) => bot.waiting && bot.team === teamAssignment.enemyTeam,
  );
  const leftoverAllies = bots.filter(
    (bot) => bot.waiting && bot.team === teamAssignment.openerTeam,
  );
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
