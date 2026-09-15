import { parseDecimalId, requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { Battle } from "./battle.ts";
import type { HuntBotSnap } from "./battle-event.ts";
import { fightStartedLabel } from "./fight-started-label.ts";
import { huntFightTitle } from "./hunt-fight-title.ts";
import type { HuntHuman } from "./hunt-human.ts";

const HUNT_FIGHT_TYPE = 1;
const PRACTICE_FIGHT_TYPE = 6;
const HUNT_HISTORY_LEVEL = 0;

type RunnedFightMember = Readonly<{
  id: number | string;
  nick: string;
  level: number | string;
  kind: number | string;
  bot: 0 | 1;
  me: 0;
  artikul_id?: string;
  instance_id?: 0;
  gag_time?: 0;
  gag_reason?: 0;
  clan_id?: 0;
  injury_time?: 0;
  injury_artikul_id?: 0;
  server_id?: 1;
  language?: "ru";
  nick_color?: 0;
  nick_color_expire?: 0;
  punish?: 0;
  dead?: boolean;
  juggernaut?: 0;
  flee?: 0 | 1;
}>;

type RunnedFightTeams = Readonly<{
  "1": readonly RunnedFightMember[];
  "2": readonly RunnedFightMember[];
}>;

export type RunnedFightRecord = Readonly<{
  id: bigint;
  title: string;
  type: number;
  timeout: number;
  levelMin: number;
  levelMax: number;
  level: number;
  mlTitle: string;
  started: string;
  duration: number;
  teams: RunnedFightTeams;
  areaId: string;
}>;

export type RunnedFightPage = Readonly<{
  pageIndex: number;
  pageCount: number;
  totalItems: number;
  fights: readonly RunnedFightRecord[];
}>;

export function runnedFightRecordOf(battle: Battle, now: Date): RunnedFightRecord {
  if (!battle.areaId) throw new Error("Runned fight requires an area id");
  if (now.getTime() < battle.startedAt.getTime()) {
    throw new Error("Runned fight cannot be listed before it started");
  }
  const board = battle.boardParticipants();
  const humans = board.humans;
  if (humans.length < 1) throw new Error("Runned fight requires a human");
  const bots = board.bots.filter((bot) => bot.team === 2);
  const lead = humans[0];
  if (!lead) throw new Error("Runned fight requires a human");
  const foe = bots[0] ?? humans.find((human) => human.team === 2);
  if (!foe) throw new Error("Runned fight requires an opponent");
  const type = battle.kind === "friendly-duel" ? PRACTICE_FIGHT_TYPE : HUNT_FIGHT_TYPE;
  const levels = [...humans.map((human) => human.level), ...bots.map((bot) => bot.level)];
  const levelMin = Math.min(...levels);
  const levelMax = Math.max(...levels);
  const arts = bots.map((bot) => String(bot.artikulId));
  const botLevels = bots.map((bot) => bot.level);
  const botLevelMin = botLevels.length === 0 ? lead.level : Math.min(...botLevels);
  const botLevelMax = botLevels.length === 0 ? lead.level : Math.max(...botLevels);
  const range = botLevelMax !== botLevelMin ? `${botLevelMin}-${botLevelMax}` : String(botLevelMin);
  return {
    id: parseDecimalId(battle.id, "fight id"),
    title: huntFightTitle(lead.nick, foe.nick),
    type,
    timeout: battle.turnTimeoutSeconds,
    levelMin,
    levelMax,
    level: HUNT_HISTORY_LEVEL,
    mlTitle:
      type === PRACTICE_FIGHT_TYPE
        ? `${lead.level}|${lead.heroId}|${lead.level}`
        : `${range}|${lead.heroId}|${arts.join(",") || String(botLevelMin)}`,
    started: fightStartedLabel(battle.startedAt),
    duration: Math.floor((now.getTime() - battle.startedAt.getTime()) / 1000),
    teams: {
      "1": humans.filter((human) => human.team === 1).map(runnedHuman),
      "2": [...humans.filter((human) => human.team === 2).map(runnedHuman), ...bots.map(runnedBot)],
    },
    areaId: battle.areaId,
  };
}

function runnedHuman(human: HuntHuman): RunnedFightMember {
  requireWireIdentity(human.heroId, "hero id");
  return {
    id: human.heroId,
    nick: human.nick,
    level: human.level,
    kind: human.kind,
    instance_id: 0,
    gag_time: 0,
    gag_reason: 0,
    clan_id: 0,
    injury_time: 0,
    injury_artikul_id: 0,
    server_id: 1,
    language: "ru",
    nick_color: 0,
    nick_color_expire: 0,
    punish: 0,
    dead: human.hp <= 0,
    juggernaut: 0,
    flee: human.leftLive ? 1 : 0,
    bot: 0,
    me: 0,
  };
}

function runnedBot(bot: HuntBotSnap): RunnedFightMember {
  requireWireIdentity(bot.artikulId, "bot artikul id");
  return {
    bot: 1,
    artikul_id: String(bot.artikulId),
    id: String(bot.id),
    nick: bot.nick,
    level: String(bot.level),
    kind: "0",
    me: 0,
  };
}
