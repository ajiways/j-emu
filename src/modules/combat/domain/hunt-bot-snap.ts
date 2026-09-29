import type { BotSnap } from "./battle-event.ts";
import type { BotFighter } from "./bot-fighter.ts";

export function huntBotSnap(bot: BotFighter, hp: number, enemyTeam: 1 | 2): BotSnap {
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
