import type { CombatPort } from "../../src/modules/combat/ports/combat-port.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../src/modules/combat/domain/combat-loadout.ts";
import type { HuntBotSpellBook } from "../../src/modules/combat/domain/hunt-bot-spell-book.ts";
import { unpublishedBotFightStats } from "../../src/modules/combat/domain/combatant-fight-stats.ts";

export const EMPTY_HUNT_BOT_SPELL_BOOK: HuntBotSpellBook = {
  nothingWeight: 100,
  spells: [],
};

export const GRYZL_FIGHT_LOOK = {
  botAvatar: "avatar_gryzl1_sm.jpg",
  botSk: "11",
  botBody: "",
} as const;

export const UNIT_HUNT_APPEARANCE = {
  avatar: "hero_1_sm.jpg",
  body: "m1",
  sk: "11",
} as const;

export const UNIT_FIGHT_SECONDARIES = {
  heroInitiative: 0,
  heroRage: 0,
  heroDexterity: 0,
  heroDefense: 0,
  heroBlock: 0,
  heroAggroCharges: 1,
  heroMagPower: 0,
  heroMagResist: 0,
} as const;

export function unitHuntStart(
  overrides: Partial<Omit<Parameters<CombatPort["startHunt"]>[0], "fightId">> = {},
): Omit<Parameters<CombatPort["startHunt"]>[0], "fightId"> {
  const botStrength = overrides.botStrength ?? 20;
  return {
    accountId: 1,
    heroId: 1,
    heroNick: "Hero",
    heroLevel: 1,
    heroKind: 1,
    heroHp: 27,
    heroMaxHp: 27,
    heroMp: 10,
    heroMaxMp: 10,
    heroStrength: 80,
    ...UNIT_FIGHT_SECONDARIES,
    botId: 2,
    botNick: "Грызль",
    botLevel: 1,
    botHp: 20,
    botStrength,
    ...GRYZL_FIGHT_LOOK,
    arena: "1_1",
    areaId: "503",
    instanceCopyId: null,
    appearance: UNIT_HUNT_APPEARANCE,
    loadout: EMPTY_COMBAT_LOADOUT,
    botSpellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
    purpose: "hunt",
    extraEnemies: [],
    allies: [],
    chatWin: "",
    chatLose: "",
    ...overrides,
    botInitiative:
      overrides.botInitiative ?? unpublishedBotFightStats(overrides.botStrength ?? 20).initiative,
    botMagPower:
      overrides.botMagPower ?? unpublishedBotFightStats(overrides.botStrength ?? 20).mag.power,
    botMagResist:
      overrides.botMagResist ?? unpublishedBotFightStats(overrides.botStrength ?? 20).mag.resist,
  };
}

export function unitHuntJoin(
  overrides: Partial<Parameters<CombatPort["joinHunt"]>[0]> = {},
): Parameters<CombatPort["joinHunt"]>[0] {
  return {
    accountId: 2,
    heroId: 2,
    heroNick: "Joiner",
    heroLevel: 1,
    heroKind: 1,
    heroHp: 27,
    heroMaxHp: 27,
    heroMp: 10,
    heroMaxMp: 10,
    heroStrength: 80,
    ...UNIT_FIGHT_SECONDARIES,
    fightId: "1",
    areaId: "503",
    instanceCopyId: null,
    team: 1,
    appearance: UNIT_HUNT_APPEARANCE,
    loadout: EMPTY_COMBAT_LOADOUT,
    ...overrides,
  };
}

export function unitHuntHumanStats(strength = 80) {
  return {
    strength,
    initiative: 0,
    rage: 0,
    dexterity: 0,
    defense: 0,
    block: 0,
    aggroCharges: 1,
    magPower: 0,
    magResist: 0,
  };
}

export const UNIT_HUNT_BATTLE_STATS = {
  heroInitiative: 0,
  heroRage: 0,
  heroDexterity: 0,
  heroDefense: 0,
  heroBlock: 0,
  heroAggroCharges: 1,
  botInitiative: 0,
  botMagPower: 0,
  botMagResist: 0,
  heroMagPower: 0,
  heroMagResist: 0,
} as const;
