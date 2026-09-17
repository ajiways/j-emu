import type { BattleEvent, HuntBotSnap } from "../../combat/domain/battle-event.ts";
import type { HuntHumanSnap } from "../../combat/domain/hunt-human.ts";

export function huntPersListEvent(
  humans: readonly HuntHumanSnap[],
  bots: readonly HuntBotSnap[],
): Readonly<Record<string, unknown>> {
  const event: Record<string, unknown> = { et: "persList" };
  for (const human of humans) {
    event[String(human.id)] = huntHumanPersFields(human);
  }
  for (const bot of bots) {
    event[String(bot.id)] = huntBotPersFields(bot);
  }
  return event;
}

export function huntPersChangeEvents(
  event: Extract<BattleEvent, { type: "pers-change" }>,
): readonly Readonly<Record<string, unknown>>[] {
  const events = [
    ...event.humans.map((human) => ({ ...huntHumanPersFields(human), et: "persChangeInfo" })),
    ...event.bots.map((bot) => ({ ...huntBotPersFields(bot), et: "persChangeInfo" })),
  ];
  if (events.length === 0) throw new Error("pers-change has no fighters");
  return events;
}

export function huntHumanPersFields(human: HuntHumanSnap): Readonly<Record<string, unknown>> {
  return {
    aggressive: false,
    berserk: 0,
    clanInfo: { id: 0 },
    dead: human.hp <= 0,
    dealtDamage: human.dealtDamage,
    faction: String(human.kind),
    hp: human.hp,
    id: human.id,
    juggernaut: false,
    level: human.level,
    maxHp: human.maxHp,
    maxMp: human.maxMp,
    mp: human.mp,
    nick: human.nick,
    team: human.team,
  };
}

function huntBotPersFields(bot: HuntBotSnap): Readonly<Record<string, unknown>> {
  return {
    aggressive: true,
    artikulId: bot.artikulId,
    avatar: bot.avatar,
    berserk: 0,
    body: bot.body,
    bot: true,
    clanInfo: [],
    dead: bot.hp <= 0,
    dealtDamage: bot.dealtDamage,
    faction: 0,
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
