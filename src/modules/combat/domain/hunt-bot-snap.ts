import type { HuntBotSnap } from "./battle-event.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";

export function huntBotSnap(bot: HuntRosterBot, hp: number, enemyTeam: 1 | 2): HuntBotSnap {
  return {
    id: bot.fightId,
    nick: bot.nick,
    level: bot.level,
    hp,
    maxHp: bot.maxHp,
    artikulId: bot.artikulId,
    avatar: bot.avatar,
    sk: bot.sk,
    body: bot.body,
    team: enemyTeam,
    dealtDamage: 0,
  };
}
