import type { FriendlyDuelBattleInit } from "../domain/friendly-duel-battle-init.ts";
import type { FriendlyDuelStartInput } from "../ports/combat-port.ts";

export function friendlyDuelInitFromStart(
  input: FriendlyDuelStartInput,
  accessKey: string,
  startedAt: Date,
  kind: "friendly-duel" | "pvp",
): FriendlyDuelBattleInit {
  return {
    kind,
    fightId: input.fightId,
    accessKey,
    arena: input.arena,
    areaId: input.areaId,
    instanceCopyId: input.instanceCopyId,
    fightFlags: input.fightFlags,
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
    initiative: input.heroInitiative,
    rage: input.heroRage,
    dexterity: input.heroDexterity,
    defense: input.heroDefense,
    block: input.heroBlock,
    aggroCharges: input.heroAggroCharges,
    magPower: input.heroMagPower,
    magResist: input.heroMagResist,
    loadout: input.loadout,
    avatar: input.avatar,
    body: input.body,
    sk: input.sk,
  };
}
