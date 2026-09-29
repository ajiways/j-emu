import type { BattleEvent } from "./battle-event.ts";
import type { Fighter } from "./fighter.ts";

export type ChargingBuffCast = Readonly<{
  artikulId: number;
  title: string;
  img: string;
  dmgType: number;
  remainTurns: number;
  groupId?: number;
  /** Wire `effUse` presentation; the spell's own animation and flags. */
  animation: string;
  flags: string | number;
  /** Standing `remainTime` override (rage reports 0); otherwise the standing effect's own. */
  remainTime?: number;
  skills?: Readonly<Record<string, number>>;
  /** Animation of the trailing self `cast`; absent when the source sends none (pocket orbs send one). */
  castAnimation: string;
  /** Events that precede the standing effect, e.g. purges of the group it replaces. */
  before?: readonly BattleEvent[];
  /** Events after the self cast, e.g. the combo-point refresh. */
  after?: readonly BattleEvent[];
}>;

/**
 * The one path for a self buff that stands on the carrier and is spent by its next strikes:
 * pocket orbs, gloves, rage and bot school overlays all attach it and announce it the same way.
 */
export function castChargingBuff(carrier: Fighter, cast: ChargingBuffCast): readonly BattleEvent[] {
  const standing = carrier.effects.attachChargingKind3({
    sourceId: carrier.id,
    artikulId: cast.artikulId,
    title: cast.title,
    img: cast.img,
    dmgType: cast.dmgType,
    remainTurns: cast.remainTurns,
    ...(cast.groupId !== undefined ? { groupId: cast.groupId } : {}),
  });
  return [
    ...(cast.before ?? []),
    {
      type: "effect-use",
      artikulId: cast.artikulId,
      animation: cast.animation,
      kind: 3,
      flags: cast.flags,
      img: standing.img,
      title: standing.title,
      persId: carrier.id,
      dmgType: standing.dmgType,
      id: standing.id,
      sourceId: standing.sourceId,
      remainTime: cast.remainTime ?? standing.remainTime,
      ...(standing.groupId !== undefined ? { groupId: standing.groupId } : {}),
      ...(cast.skills !== undefined ? { skills: cast.skills } : {}),
    },
    {
      type: "buff-cast",
      animation: cast.castAnimation,
      sourceId: carrier.id,
      targetId: carrier.id,
      maxHp: carrier.maxHp,
    },
    ...(cast.after ?? []),
  ];
}
