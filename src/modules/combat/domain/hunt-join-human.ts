import type { CombatLoadout } from "./combat-loadout.ts";

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
  loadout: CombatLoadout;
}>;
