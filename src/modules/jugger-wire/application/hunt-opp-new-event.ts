import type { HuntBotSnap } from "../../combat/domain/battle-event.ts";

export function huntOppNewEvent(bot: HuntBotSnap): Readonly<Record<string, unknown>> {
  return {
    aggressive: true,
    artikulId: bot.artikulId,
    avatar: bot.avatar,
    body: bot.body,
    bot: true,
    dead: false,
    et: "oppnew",
    hp: bot.hp,
    id: bot.id,
    level: bot.level,
    maxHp: bot.maxHp,
    maxMp: 0,
    mp: 0,
    nick: bot.nick,
    sk: bot.sk,
    team: bot.team,
  };
}
