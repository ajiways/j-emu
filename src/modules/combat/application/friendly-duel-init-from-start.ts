import type { FriendlyDuelBattleInit } from "../domain/friendly-duel-battle-init.ts";
import type { FriendlyDuelStartInput } from "../ports/combat-port.ts";

export function friendlyDuelInitFromStart(
  input: FriendlyDuelStartInput,
  accessKey: string,
  startedAt: Date,
): FriendlyDuelBattleInit {
  return {
    kind: "friendly-duel",
    fightId: input.fightId,
    accessKey,
    arena: input.arena,
    areaId: input.areaId,
    startedAt,
    challenger: fighter(input.challenger),
    acceptor: fighter(input.acceptor),
  };
}

function fighter(input: FriendlyDuelStartInput["challenger"]) {
  return {
    accountId: input.accountId,
    heroId: input.heroId,
    nick: input.heroNick,
    level: input.heroLevel,
    kind: input.heroKind,
    hp: input.heroHp,
    maxHp: input.heroMaxHp,
    mp: input.heroMp,
    maxMp: input.heroMaxMp,
    strength: input.heroStrength,
    loadout: input.loadout,
    avatar: input.avatar,
    body: input.body,
    sk: input.sk,
  };
}
