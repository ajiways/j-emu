import type { StrikeMods } from "./strike-mods.ts";
import { remainingSeconds, type PeriodicState } from "./periodic-effect.ts";

const TURN_SECONDS = 40;

export type FightTickPulse = Readonly<{
  effectId: number;
  kind: number;
  sourceId: number;
  dmgType: number;
  amount?: number | string;
  catalogPcStr: number;
  catalogStr: number;
  casterStrength: number;
  casterMagPower: number;
  casterMagResist: number;
}>;

/** What one clock step did to the effects: a tick to apply, or an effect that ran out. */
export type PeriodicItem =
  | Readonly<{ kind: "tick"; pulse: FightTickPulse }>
  | Readonly<{ kind: "expire"; effectId: number }>;

export type FightEffectSnap = Readonly<{
  id: number;
  kind: number;
  sourceId: number;
  artikulId: number;
  title: string;
  img: string;
  dmgType: number;
  /** Absent for a buff that lasts the whole fight. */
  remainTime?: number;
  groupId?: number;
  skills: Readonly<Record<string, number>>;
}>;

export type StandingEffect = {
  id: number;
  kind: number;
  sourceId: number;
  artikulId: number;
  title: string;
  img: string;
  dmgType: number;
  groupId?: number;
  skills: Readonly<Record<string, number>>;
  remainTurns: number;
  expiresAtMs: number;
  periodic?: PeriodicState;
  tickAmount?: number | string;
  catalogPcStr?: number;
  catalogStr?: number;
  casterStrength?: number;
  casterMagPower?: number;
  casterMagResist?: number;
  charging?: boolean;
  /** Set on a charging effect: what the strikes that spend it get. */
  strike?: StrikeMods;
  stun?: boolean;
  /** No duration in the data: lasts to the end of the fight, `remainTime` is left off the wire. */
  fightLong?: boolean;
  /** Damage types (bit set) that `DFR`/`ADFR`/`DMG_AMP` of this effect cover; absent — all. */
  dmgMask?: number;
};

/** The wire view of a standing effect; a periodic one reports the time left at `nowMs`. */
export function snapOf(fx: StandingEffect, nowMs?: number): FightEffectSnap {
  return {
    id: fx.id,
    kind: fx.kind,
    sourceId: fx.sourceId,
    artikulId: fx.artikulId,
    title: fx.title,
    img: fx.img,
    dmgType: fx.dmgType,
    ...(fx.fightLong
      ? {}
      : {
          remainTime: fx.periodic
            ? Math.ceil(remainingSeconds(fx.periodic, nowMs))
            : fx.remainTurns * TURN_SECONDS,
        }),
    ...(fx.groupId !== undefined ? { groupId: fx.groupId } : {}),
    skills: fx.skills,
  };
}
