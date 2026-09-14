import type { CombatLoadout } from "./combat-loadout.ts";
import type { HuntHumanAppearance } from "./hunt-human.ts";

export type HuntJoinHuman = Readonly<{
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
  team: 1 | 2;
  appearance: HuntHumanAppearance;
  loadout: CombatLoadout;
  startedAtMs: number;
}>;
