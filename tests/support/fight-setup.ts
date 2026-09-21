import { EMPTY_COMBAT_LOADOUT } from "../../src/modules/combat/domain/combat-loadout.ts";
import type { CombatLoadout } from "../../src/modules/combat/domain/combat-loadout.ts";
import type { FightKind } from "../../src/modules/combat/domain/fight-rules.ts";
import type {
  FightSetup,
  FightSetupAi,
  FightSetupHuman,
  FightSetupJoin,
} from "../../src/modules/combat/domain/fight-setup.ts";
import type { HuntBotSpellBook } from "../../src/modules/combat/domain/hunt-bot-spell-book.ts";
import type { HuntHumanAppearance } from "../../src/modules/combat/domain/hunt-human.ts";
import type { HuntRosterBotSeed } from "../../src/modules/combat/domain/hunt-roster-bot.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  GRYZL_FIGHT_LOOK,
  UNIT_HUNT_APPEARANCE,
  UNIT_HUNT_BATTLE_STATS,
  unitHuntHumanStats,
} from "./hunt-start-input.ts";

export type UnitHuntFightSetupOverlay = {
  purpose?: "hunt" | "quest";
  fightId?: string;
  accessKey?: string;
  accountId?: number;
  heroId?: number;
  heroNick?: string;
  heroLevel?: number;
  heroKind?: number;
  heroMp?: number;
  heroMaxMp?: number;
  heroStrength?: number;
  heroInitiative?: number;
  heroRage?: number;
  heroDexterity?: number;
  heroDefense?: number;
  heroBlock?: number;
  heroAggroCharges?: number;
  heroMagPower?: number;
  heroMagResist?: number;
  botArtikulId?: number;
  botFightId?: number;
  botNick?: string;
  botLevel?: number;
  botAvatar?: string;
  botSk?: string;
  botBody?: string;
  playerHp?: number;
  playerMaxHp?: number;
  botMaxHp?: number;
  botStrength?: number;
  botInitiative?: number;
  botMagPower?: number;
  botMagResist?: number;
  botSpellBook?: HuntBotSpellBook;
  arena?: string;
  areaId?: string;
  instanceCopyId?: number | null;
  fightFlags?: string | null;
  startedAt?: Date;
  loadout?: CombatLoadout;
  appearance?: HuntHumanAppearance;
  extraEnemies?: readonly HuntRosterBotSeed[];
  allies?: readonly HuntRosterBotSeed[];
  chatWin?: string;
  chatLose?: string;
  kind?: FightKind;
};

export function unitHuntFightSetup(overrides: UnitHuntFightSetupOverlay = {}): FightSetup {
  const kind = overrides.kind ?? overrides.purpose ?? "hunt";
  const openerTeam = kind === "quest" ? 2 : 1;
  const human = unitSetupHuman(overrides);
  const primary = unitSetupPrimary(overrides);
  const extra = (overrides.extraEnemies ?? []).map(aiFromSeed);
  const allies = (overrides.allies ?? []).map(aiFromSeed);
  const opener = [human, ...allies];
  const enemy = [primary, ...extra];
  return {
    meta: {
      kind,
      fightId: overrides.fightId ?? "1",
      accessKey: overrides.accessKey ?? "access-key",
      arena: overrides.arena ?? "1_1",
      areaId: overrides.areaId ?? "503",
      instanceCopyId: overrides.instanceCopyId === undefined ? null : overrides.instanceCopyId,
      fightFlags: overrides.fightFlags === undefined ? null : overrides.fightFlags,
      startedAt: overrides.startedAt ?? new Date("2026-09-07T12:00:00.000Z"),
      chatWin: overrides.chatWin ?? "",
      chatLose: overrides.chatLose ?? "",
    },
    teams: openerTeam === 1 ? { 1: opener, 2: enemy } : { 1: enemy, 2: opener },
  };
}

export function unitDuelFightSetup(
  overrides: {
    kind?: "friendly-duel" | "pvp";
    fightId?: string;
    accessKey?: string;
    arena?: string;
    areaId?: string;
    instanceCopyId?: number | null;
    fightFlags?: string | null;
    startedAt?: Date;
    challenger?: Partial<FightSetupHuman>;
    acceptor?: Partial<FightSetupHuman>;
  } = {},
): FightSetup {
  return {
    meta: {
      kind: overrides.kind ?? "friendly-duel",
      fightId: overrides.fightId ?? "8",
      accessKey: overrides.accessKey ?? "duel-key",
      arena: overrides.arena ?? "1_1",
      areaId: overrides.areaId ?? "503",
      instanceCopyId: overrides.instanceCopyId === undefined ? null : overrides.instanceCopyId,
      fightFlags: overrides.fightFlags === undefined ? null : overrides.fightFlags,
      startedAt: overrides.startedAt ?? new Date("2026-09-07T12:00:00.000Z"),
      chatWin: "",
      chatLose: "",
    },
    teams: {
      1: [unitDuelHuman(1, 1, "A", overrides.challenger)],
      2: [unitDuelHuman(2, 2, "B", overrides.acceptor)],
    },
  };
}

export function unitFightJoin(overrides: Partial<FightSetupJoin> = {}): FightSetupJoin {
  return {
    accountId: 2,
    heroId: 2,
    nick: "Joiner",
    level: 1,
    kind: 1,
    hp: 27,
    maxHp: 27,
    mp: 10,
    maxMp: 10,
    ...unitHuntHumanStats(80),
    appearance: UNIT_HUNT_APPEARANCE,
    loadout: EMPTY_COMBAT_LOADOUT,
    team: 1,
    startedAtMs: Date.parse("2026-09-07T12:00:00.000Z"),
    ...overrides,
    controller: "human",
  };
}

function unitSetupHuman(overrides: UnitHuntFightSetupOverlay): FightSetupHuman {
  return {
    controller: "human",
    accountId: overrides.accountId ?? 1,
    heroId: overrides.heroId ?? 1,
    nick: overrides.heroNick ?? "Hero",
    level: overrides.heroLevel ?? 1,
    kind: overrides.heroKind ?? 1,
    hp: overrides.playerHp ?? 27,
    maxHp: overrides.playerMaxHp ?? 27,
    mp: overrides.heroMp ?? 10,
    maxMp: overrides.heroMaxMp ?? 10,
    strength: overrides.heroStrength ?? 80,
    initiative: overrides.heroInitiative ?? UNIT_HUNT_BATTLE_STATS.heroInitiative,
    rage: overrides.heroRage ?? UNIT_HUNT_BATTLE_STATS.heroRage,
    dexterity: overrides.heroDexterity ?? UNIT_HUNT_BATTLE_STATS.heroDexterity,
    defense: overrides.heroDefense ?? UNIT_HUNT_BATTLE_STATS.heroDefense,
    block: overrides.heroBlock ?? UNIT_HUNT_BATTLE_STATS.heroBlock,
    aggroCharges: overrides.heroAggroCharges ?? UNIT_HUNT_BATTLE_STATS.heroAggroCharges,
    magPower: overrides.heroMagPower ?? UNIT_HUNT_BATTLE_STATS.heroMagPower,
    magResist: overrides.heroMagResist ?? UNIT_HUNT_BATTLE_STATS.heroMagResist,
    loadout: overrides.loadout ?? EMPTY_COMBAT_LOADOUT,
    appearance: overrides.appearance ?? UNIT_HUNT_APPEARANCE,
  };
}

function unitSetupPrimary(overrides: UnitHuntFightSetupOverlay): FightSetupAi {
  return {
    controller: "ai",
    fightId: overrides.botFightId ?? 1_000_000,
    artikulId: overrides.botArtikulId ?? 2,
    nick: overrides.botNick ?? "Грызль",
    level: overrides.botLevel ?? 1,
    hp: overrides.botMaxHp ?? 20,
    strength: overrides.botStrength ?? 20,
    initiative: overrides.botInitiative ?? UNIT_HUNT_BATTLE_STATS.botInitiative,
    magPower: overrides.botMagPower ?? UNIT_HUNT_BATTLE_STATS.botMagPower,
    magResist: overrides.botMagResist ?? UNIT_HUNT_BATTLE_STATS.botMagResist,
    avatar: overrides.botAvatar ?? GRYZL_FIGHT_LOOK.botAvatar,
    sk: overrides.botSk ?? GRYZL_FIGHT_LOOK.botSk,
    body: overrides.botBody ?? GRYZL_FIGHT_LOOK.botBody,
    spellBook: overrides.botSpellBook ?? EMPTY_HUNT_BOT_SPELL_BOOK,
  };
}

function unitDuelHuman(
  accountId: number,
  heroId: number,
  nick: string,
  overrides: Partial<FightSetupHuman> = {},
): FightSetupHuman {
  return {
    accountId,
    heroId,
    nick,
    level: 1,
    kind: 1,
    hp: 27,
    maxHp: 27,
    mp: 10,
    maxMp: 10,
    strength: 10,
    initiative: 0,
    rage: 0,
    dexterity: 0,
    defense: 0,
    block: 0,
    aggroCharges: 0,
    magPower: 0,
    magResist: 0,
    loadout: EMPTY_COMBAT_LOADOUT,
    appearance: { avatar: "avatar_small.jpg", body: "m1", sk: "1" },
    ...overrides,
    controller: "human",
  };
}

function aiFromSeed(seed: HuntRosterBotSeed): FightSetupAi {
  return { controller: "ai", ...seed };
}
