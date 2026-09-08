import type { BotDefinition } from "../../catalog/domain/bot-definition.ts";
import type { Area } from "../../world/domain/area.ts";
import type { HuntSpawn } from "../../world/domain/hunt-spawn.ts";
import type { AreaConfItem } from "./area-conf-item-wire.ts";

export type AreaHuntBotLook = Readonly<{
  id: number;
  nick: string;
  level: number;
  kind: number;
  speed: number;
  hunt_swf: string;
  hunt_scale: number;
  hunt_fps: number;
  avatar: string;
  hide_on_map: number;
}>;

type LocationAreaConf = Readonly<{
  area_id: string;
  title: string;
  ftime_max: number;
  items: readonly AreaConfItem[];
  code: string;
  client_data: "";
  swf: string;
  region_map: string;
  sound_intro: string;
  sound_bg: string;
  inst_artikul_id: number;
  context: string;
  have_trade_channel: number;
  have_kind_channel: number;
  hide_finished_fights: number;
  hide_running_fights: number;
  no_clan_chat: number;
  hunt_bots: Readonly<Record<string, AreaHuntBotLook>>;
  hunt_farm: readonly [];
}>;

export type LocationAreaConfBlock = Readonly<{
  status: 100;
  area_ftime: number;
  area_conf: LocationAreaConf;
}>;

export function huntBotsForArea(
  spawns: readonly HuntSpawn[],
  bots: ReadonlyMap<number, BotDefinition>,
): Readonly<Record<string, AreaHuntBotLook>> {
  const looks: Record<string, AreaHuntBotLook> = {};
  for (const spawn of spawns) {
    const bot = bots.get(spawn.botId);
    if (!bot) throw new Error(`Bot catalog entry ${spawn.botId} is missing`);
    const key = String(bot.id);
    if (looks[key]) continue;
    looks[key] = {
      id: bot.id,
      nick: bot.hunt.nick,
      level: bot.level,
      kind: bot.hunt.kind,
      speed: bot.hunt.speed,
      hunt_swf: bot.hunt.swf,
      hunt_scale: bot.hunt.scale,
      hunt_fps: bot.hunt.fps,
      avatar: bot.hunt.avatar,
      hide_on_map: bot.hunt.hideOnMap,
    };
  }
  return looks;
}

export function buildLocationAreaConf(
  area: Area,
  huntBots: Readonly<Record<string, AreaHuntBotLook>>,
  items: readonly AreaConfItem[],
  areaFtime: number,
): LocationAreaConfBlock {
  if (!Number.isInteger(areaFtime) || areaFtime < 0) {
    throw new Error("area_ftime must be a non-negative integer");
  }
  return {
    status: 100,
    area_ftime: areaFtime,
    area_conf: {
      area_id: area.id,
      title: area.title,
      ftime_max: area.ftimeMax,
      items,
      code: area.code,
      client_data: "",
      swf: area.map,
      region_map: area.regionMap,
      sound_intro: area.soundIntro,
      sound_bg: area.soundBg,
      inst_artikul_id: area.instArtikulId,
      context: area.context,
      have_trade_channel: area.haveTradeChannel,
      have_kind_channel: area.haveKindChannel,
      hide_finished_fights: area.hideFinishedFights,
      hide_running_fights: area.hideRunningFights,
      no_clan_chat: area.noClanChat,
      hunt_bots: huntBots,
      hunt_farm: [],
    },
  };
}
