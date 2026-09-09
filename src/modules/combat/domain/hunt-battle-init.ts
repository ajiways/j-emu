import type { CombatLoadout } from "./combat-loadout.ts";

export type HuntBattleInit = Readonly<{
  fightId: string;
  accessKey: string;
  accountId: number;
  heroId: number;
  heroNick: string;
  heroLevel: number;
  heroKind: number;
  heroMp: number;
  heroMaxMp: number;
  botArtikulId: number;
  botFightId: number;
  botNick: string;
  botLevel: number;
  botAvatar: string;
  botSk: string;
  botBody: string;
  playerHp: number;
  playerMaxHp: number;
  botMaxHp: number;
  arena: string;
  areaId: string;
  startedAt: Date;
  loadout: CombatLoadout;
}>;
