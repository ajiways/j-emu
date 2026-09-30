import type { StrikeMods } from "./strike-mods.ts";

export type ChargingKind3Input = Readonly<{
  /** What the strikes that spend this effect get from it. */
  strike: StrikeMods;
  sourceId: number;
  artikulId: number;
  title: string;
  img: string;
  dmgType: number;
  remainTurns: number;
  groupId?: number;
}>;

export type TickEffectInput = Readonly<{
  kind: 4 | 5;
  sourceId: number;
  artikulId: number;
  title: string;
  img: string;
  dmgType: number;
  groupId?: number;
  durationSeconds: number;
  periodSeconds: number;
  nowMs: number;
  castEndsTurn: boolean;
  amount?: number | string;
  catalogPcStr: number;
  catalogStr: number;
  casterStrength: number;
  casterMagPower: number;
  casterMagResist: number;
}>;

export type StunEffectInput = Readonly<{
  sourceId: number;
  artikulId: number;
  title: string;
  img: string;
  remainTurns: number;
  groupId?: number;
}>;
