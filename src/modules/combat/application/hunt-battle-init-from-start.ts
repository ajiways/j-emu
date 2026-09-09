import type { HuntBattleInit } from "../domain/hunt-battle-init.ts";
import type { HuntStartInput } from "../ports/combat-port.ts";

export function huntBattleInitFromStart(
  input: HuntStartInput,
  accessKey: string,
  botFightId: number,
  startedAt: Date,
): HuntBattleInit {
  return {
    fightId: input.fightId,
    accessKey,
    accountId: input.accountId,
    heroId: input.heroId,
    heroNick: input.heroNick,
    heroLevel: input.heroLevel,
    heroKind: input.heroKind,
    heroMp: input.heroMp,
    heroMaxMp: input.heroMaxMp,
    botArtikulId: input.botId,
    botFightId,
    botNick: input.botNick,
    botLevel: input.botLevel,
    botAvatar: input.botAvatar,
    botSk: input.botSk,
    botBody: input.botBody,
    playerHp: input.heroHp,
    playerMaxHp: input.heroMaxHp,
    botMaxHp: input.botHp,
    arena: input.arena,
    areaId: input.areaId,
    startedAt,
  };
}
