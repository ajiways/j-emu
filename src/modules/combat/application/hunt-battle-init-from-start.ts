import type { HuntBattleInit } from "../domain/hunt-battle-init.ts";
import type { HuntRosterBotSeed } from "../domain/hunt-roster-bot.ts";
import type { HuntStartInput } from "../ports/combat-port.ts";

export function huntBattleInitFromStart(
  input: HuntStartInput,
  accessKey: string,
  botFightId: number,
  startedAt: Date,
  extraEnemies: readonly HuntRosterBotSeed[],
  allies: readonly HuntRosterBotSeed[],
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
    instanceCopyId: input.instanceCopyId,
    startedAt,
    loadout: input.loadout,
    appearance: input.appearance,
    heroStrength: input.heroStrength,
    botStrength: input.botStrength,
    botSpellBook: input.botSpellBook,
    purpose: input.purpose,
    extraEnemies,
    allies,
    chatWin: input.chatWin,
    chatLose: input.chatLose,
  };
}
