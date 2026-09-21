import type { CombatLoadout } from "./combat-loadout.ts";
import type { FightKind } from "./fight-rules.ts";
import type { HuntBotSpellBook } from "./hunt-bot-spell-book.ts";
import type { HuntHumanAppearance } from "./hunt-human.ts";

export type FightSetupHuman = Readonly<{
  controller: "human";
  accountId: number;
  heroId: number;
  nick: string;
  level: number;
  kind: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  strength: number;
  initiative: number;
  rage: number;
  dexterity: number;
  defense: number;
  block: number;
  aggroCharges: number;
  magPower: number;
  magResist: number;
  loadout: CombatLoadout;
  appearance: HuntHumanAppearance;
}>;

export type FightSetupAi = Readonly<{
  controller: "ai";
  fightId: number;
  artikulId: number;
  nick: string;
  level: number;
  hp: number;
  strength: number;
  initiative: number;
  magPower: number;
  magResist: number;
  avatar: string;
  sk: string;
  body: string;
  spellBook: HuntBotSpellBook;
}>;

export type FightSetupParticipant = FightSetupHuman | FightSetupAi;

type FightSetupMeta = Readonly<{
  kind: FightKind;
  fightId: string;
  accessKey: string;
  arena: string;
  areaId: string;
  instanceCopyId: number | null;
  fightFlags: string | null;
  startedAt: Date;
  chatWin: string;
  chatLose: string;
}>;

export type FightSetup = Readonly<{
  meta: FightSetupMeta;
  teams: Readonly<{
    1: readonly FightSetupParticipant[];
    2: readonly FightSetupParticipant[];
  }>;
}>;

export type FightSetupJoin = FightSetupHuman &
  Readonly<{
    team: 1 | 2;
    startedAtMs: number;
  }>;

export function isFightSetupHuman(
  participant: FightSetupParticipant,
): participant is FightSetupHuman {
  return participant.controller === "human";
}

export function isFightSetupAi(participant: FightSetupParticipant): participant is FightSetupAi {
  return participant.controller === "ai";
}

export function fightSetupHumans(setup: FightSetup): readonly FightSetupHuman[] {
  return [...setup.teams[1], ...setup.teams[2]].filter(isFightSetupHuman);
}

export function fightSetupAis(setup: FightSetup): readonly FightSetupAi[] {
  return [...setup.teams[1], ...setup.teams[2]].filter(isFightSetupAi);
}

export function fightSetupTeamAis(setup: FightSetup, team: 1 | 2): readonly FightSetupAi[] {
  return setup.teams[team].filter(isFightSetupAi);
}

export function fightSetupTeamHumans(setup: FightSetup, team: 1 | 2): readonly FightSetupHuman[] {
  return setup.teams[team].filter(isFightSetupHuman);
}

export function requireFightSetupPrimaryEnemy(setup: FightSetup, enemyTeam: 1 | 2): FightSetupAi {
  const primary = fightSetupTeamAis(setup, enemyTeam)[0];
  if (!primary) throw new Error("Fight setup is missing the primary enemy bot");
  return primary;
}

export function aiRosterSeed(ai: FightSetupAi) {
  return {
    fightId: ai.fightId,
    artikulId: ai.artikulId,
    nick: ai.nick,
    level: ai.level,
    hp: ai.hp,
    strength: ai.strength,
    initiative: ai.initiative,
    magPower: ai.magPower,
    magResist: ai.magResist,
    avatar: ai.avatar,
    sk: ai.sk,
    body: ai.body,
    spellBook: ai.spellBook,
  };
}
