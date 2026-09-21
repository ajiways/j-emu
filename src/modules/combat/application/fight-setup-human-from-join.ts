import type { FightSetupJoin } from "../domain/fight-setup.ts";
import type { HuntJoinInput } from "../ports/combat-port.ts";

export function fightSetupJoinFromInput(input: HuntJoinInput, startedAtMs: number): FightSetupJoin {
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
    team: input.team,
    startedAtMs,
  };
}
