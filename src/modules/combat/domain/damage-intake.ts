/** The part of a standing effect that changes the damage its carrier takes. */
export type IntakeEffect = Readonly<{
  /** Damage types (bit set) the effect covers; absent — all of them. */
  dmgMask?: number;
  skills: Readonly<Record<string, number>>;
}>;

/** Physical blows: the only damage `DFR` holds back. `MAG_DFR` covers magic; type 256 (death signs) is neither. */
const PHYSICAL = 1;
const DEATH_SIGN = 256;

/**
 * The hit after everything the carrier stands under (ADR-0021): `DFR` for a physical hit or
 * `MAG_DFR` for a magic one keeps that share out, `DMG_AMP` adds to it, and `ADFR` takes its share
 * off the final figure. Effects apply by their `dmgMask`. A hit stays at least 1 unless a factor
 * is a full immunity.
 */
export function takenDamage(
  effects: readonly IntakeEffect[],
  raw: number,
  dmgType: number,
): number {
  if (!Number.isInteger(raw) || raw < 0) throw new Error("Hit raw must be a non-negative integer");
  let factor = 1;
  for (const effect of effects) {
    if (effect.dmgMask !== undefined && (effect.dmgMask & dmgType) === 0) continue;
    factor *= 1 - held(effect.skills, dmgType);
    factor *= 1 + (effect.skills.DMG_AMP ?? 0) + (effect.skills.pcDMG_AMP ?? 0) / 100;
    factor *= 1 - clamp01(effect.skills.ADFR ?? 0);
  }
  if (factor === 1 || raw === 0) return raw;
  if (factor <= 0) return 0;
  return Math.max(1, Math.round(raw * factor));
}

function held(skills: Readonly<Record<string, number>>, dmgType: number): number {
  if (dmgType === PHYSICAL) return clamp01(skills.DFR ?? 0);
  if (dmgType === DEATH_SIGN) return 0;
  return clamp01(skills.MAG_DFR ?? 0);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
