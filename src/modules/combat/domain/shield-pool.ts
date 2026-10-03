import type { BattleEvent } from "./battle-event.ts";
import type { Fighter } from "./fighter.ts";
import type { StandingEffect } from "./standing-effect.ts";

/** A shield effect (`kind 9`): what it can still take, which damage it covers, how much of a hit. */
export type ShieldState = {
  remaining: number;
  /** Damage types (bit set) it holds back. */
  mask: number;
  /** The share of one hit the shield takes, in percent (`limit` of the data). */
  limitPct: number;
};

/** What the shields did to the last hit: the damage they took and the shields it used up. */
export type HitShield = Readonly<{ absorbed: number; purged: readonly number[] }>;

export const NO_HIT_SHIELD: HitShield = { absorbed: 0, purged: [] };

/**
 * A hit of `damage` against the shields standing, oldest first: each takes its share of what is
 * left of the hit, up to what it can still hold; one that is empty goes out of `standing`.
 */
export function absorbIntoShields(
  standing: StandingEffect[],
  damage: number,
  dmgType: number,
): Readonly<{ passed: number; hit: HitShield }> {
  let passed = damage;
  let absorbed = 0;
  const purged: number[] = [];
  for (const fx of [...standing]) {
    const shield = fx.shield;
    if (!shield || (shield.mask & dmgType) === 0 || passed < 1) continue;
    const taken = Math.min(shield.remaining, Math.floor((passed * shield.limitPct) / 100));
    if (taken < 1) continue;
    shield.remaining -= taken;
    passed -= taken;
    absorbed += taken;
    if (shield.remaining > 0) continue;
    standing.splice(standing.indexOf(fx), 1);
    purged.push(fx.id);
  }
  return { passed, hit: absorbed === 0 ? NO_HIT_SHIELD : { absorbed, purged } };
}

/**
 * What a hit's shield part shows: the damage the shields took (an `hpChange` that moves no hit
 * points, with `absorb`) and the `effPurge` of each shield that is spent.
 */
export function shieldEvents(
  sourceId: number,
  target: Fighter,
  hit: HitShield,
): readonly BattleEvent[] {
  if (hit.absorbed === 0) return [];
  return [
    {
      type: "damage",
      sourceId,
      targetId: target.id,
      animation: "",
      hpChange: 0,
      targetMaxHp: target.maxHp,
      killed: false,
      react: 0,
      dmgType: 0,
      absorb: hit.absorbed,
    },
    ...hit.purged.map((effectId) => ({ type: "effect-purge" as const, effectId })),
  ];
}
