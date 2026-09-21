import type { FightTeamAssignment } from "../domain/fight-rules.ts";
import type { FightSetup, FightSetupHuman } from "../domain/fight-setup.ts";
import type { FriendlyDuelStartInput } from "../ports/combat-port.ts";

export function fightSetupFromHumanDuel(
  input: FriendlyDuelStartInput,
  accessKey: string,
  startedAt: Date,
  kind: "friendly-duel" | "pvp",
  teamAssignment: FightTeamAssignment,
): FightSetup {
  const challenger = duelHuman(input.challenger);
  const acceptor = duelHuman(input.acceptor);
  return {
    meta: {
      kind,
      fightId: input.fightId,
      accessKey,
      arena: input.arena,
      areaId: input.areaId,
      instanceCopyId: input.instanceCopyId,
      fightFlags: input.fightFlags,
      startedAt,
      chatWin: "",
      chatLose: "",
    },
    teams:
      teamAssignment.openerTeam === 1
        ? { 1: [challenger], 2: [acceptor] }
        : { 1: [acceptor], 2: [challenger] },
  };
}

function duelHuman(input: FriendlyDuelStartInput["challenger"]): FightSetupHuman {
  return {
    controller: "human",
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
    appearance: { avatar: input.avatar, body: input.body, sk: input.sk },
  };
}
