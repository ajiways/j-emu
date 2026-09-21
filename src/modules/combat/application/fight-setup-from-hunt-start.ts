import type { FightTeamAssignment } from "../domain/fight-rules.ts";
import type { FightSetup, FightSetupAi, FightSetupHuman } from "../domain/fight-setup.ts";
import type { HuntRosterBotSeed } from "../domain/hunt-roster-bot.ts";
import type { HuntStartInput } from "../ports/combat-port.ts";

export function fightSetupFromHuntStart(
  input: HuntStartInput,
  accessKey: string,
  botFightId: number,
  startedAt: Date,
  extraEnemies: readonly HuntRosterBotSeed[],
  allies: readonly HuntRosterBotSeed[],
  teamAssignment: FightTeamAssignment,
): FightSetup {
  const human = huntHuman(input);
  const primary = huntPrimaryAi(input, botFightId);
  const opener = [human, ...allies.map(aiFromSeed)];
  const enemy = [primary, ...extraEnemies.map(aiFromSeed)];
  return {
    meta: {
      kind: input.purpose,
      fightId: input.fightId,
      accessKey,
      arena: input.arena,
      areaId: input.areaId,
      instanceCopyId: input.instanceCopyId,
      fightFlags: null,
      startedAt,
      chatWin: input.chatWin,
      chatLose: input.chatLose,
    },
    teams: teamAssignment.openerTeam === 1 ? { 1: opener, 2: enemy } : { 1: enemy, 2: opener },
  };
}

function huntHuman(input: HuntStartInput): FightSetupHuman {
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
    appearance: input.appearance,
  };
}

function huntPrimaryAi(input: HuntStartInput, botFightId: number): FightSetupAi {
  return {
    controller: "ai",
    fightId: botFightId,
    artikulId: input.botId,
    nick: input.botNick,
    level: input.botLevel,
    hp: input.botHp,
    strength: input.botStrength,
    initiative: input.botInitiative,
    magPower: input.botMagPower,
    magResist: input.botMagResist,
    avatar: input.botAvatar,
    sk: input.botSk,
    body: input.botBody,
    spellBook: input.botSpellBook,
  };
}

function aiFromSeed(seed: HuntRosterBotSeed): FightSetupAi {
  return { controller: "ai", ...seed };
}
