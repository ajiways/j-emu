import type { CombatPort } from "../../src/modules/combat/ports/combat-port.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../src/modules/combat/domain/combat-loadout.ts";

export const GRYZL_FIGHT_LOOK = {
  botAvatar: "avatar_gryzl1_sm.jpg",
  botSk: "11",
  botBody: "",
} as const;

export function unitHuntStart(
  overrides: Partial<Omit<Parameters<CombatPort["startHunt"]>[0], "fightId">> = {},
): Omit<Parameters<CombatPort["startHunt"]>[0], "fightId"> {
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
    botId: 2,
    botNick: "Грызль",
    botLevel: 1,
    botHp: 20,
    ...GRYZL_FIGHT_LOOK,
    arena: "1_1",
    areaId: "503",
    loadout: EMPTY_COMBAT_LOADOUT,
    ...overrides,
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
    fightId: "1",
    areaId: "503",
    team: 1,
    loadout: EMPTY_COMBAT_LOADOUT,
    ...overrides,
  };
}
