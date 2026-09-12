import type { HuntBotSnap } from "./battle-event.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import { huntFightEnemyTeam } from "./hunt-fight-teams.ts";

export function huntBotSnap(init: HuntBattleInit, hp: number): HuntBotSnap {
  return {
    id: init.botFightId,
    nick: init.botNick,
    level: init.botLevel,
    hp,
    maxHp: init.botMaxHp,
    artikulId: init.botArtikulId,
    avatar: init.botAvatar,
    sk: init.botSk,
    body: init.botBody,
    team: huntFightEnemyTeam(init.purpose),
  };
}
