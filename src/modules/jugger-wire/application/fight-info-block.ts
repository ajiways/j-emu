import { macroKeyId } from "../../../shared/kernel/macro-key-id.ts";
import type { FightResultInfo } from "../../combat/domain/fight-result-info.ts";

export function fightInfoBlock(
  info: FightResultInfo,
  areaTitle: string,
): Readonly<Record<string, unknown>> {
  if (!areaTitle) throw new Error(`Fight ${info.fightId} area title is required`);
  const shareKey = macroKeyId("SHARE", info.fightId);
  const users: Record<string, unknown> = {};
  for (const user of info.users) {
    users[String(user.participantId)] = {
      id: user.id,
      bot: user.bot,
      artikul_id: user.artikulId,
      team: user.team,
      nick: user.nick,
      nick_info: "",
      money: user.money,
      level: user.level,
      kind: user.kind,
      flee: user.flee,
      loot: user.loot,
      injury: user.injury,
      kill_count: user.killCount,
      exp: user.exp,
      honor: user.honor,
      dmg: user.dmg,
      heal: user.heal,
      dead: user.dead,
      offline: user.offline,
      hp: user.hp,
      mp: user.mp,
      hpMax: user.hpMax,
      mpMax: user.mpMax,
    };
  }
  return {
    status: 100,
    winner_team: info.winnerTeam,
    fight: {
      id: info.fightId,
      title: info.title,
      type: info.type,
      started: info.started,
      duration: info.duration,
      area: areaTitle,
      finished: info.finished,
      timeout: info.timeout,
    },
    users,
    share: `[[SHARE ${shareKey}]]`,
    macroses: {
      [shareKey]: {
        link: `/fight_info.php?fight_id=${info.fightId}`,
        title: "файт_инфо",
        text: "Завершился бой!",
        image: "/images/data/soc_img/alt_arena.jpg",
        image_vk: "",
        link_title: "/",
        key_id: shareKey,
        macro_type: "SHARE",
      },
    },
  };
}
