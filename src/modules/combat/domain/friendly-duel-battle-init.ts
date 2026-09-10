import type { CombatLoadout } from "./combat-loadout.ts";

export type FriendlyDuelFighterInit = Readonly<{
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
  loadout: CombatLoadout;
  avatar: string;
  body: string;
  sk: string;
}>;

export type FriendlyDuelBattleInit = Readonly<{
  kind: "friendly-duel" | "pvp";
  fightId: string;
  accessKey: string;
  arena: string;
  areaId: string;
  startedAt: Date;
  challenger: FriendlyDuelFighterInit;
  acceptor: FriendlyDuelFighterInit;
}>;
