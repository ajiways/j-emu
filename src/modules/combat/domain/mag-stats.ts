/** Snapshot MAGSTR/MAGRES at fight start. Physical dmgType 1 and 256 never use the pool. */
export type MagStats = Readonly<{
  power: number;
  resist: number;
}>;

/** Named unpublished policy: no hero_skills MAGSTR/MAGRES and no bot extra.combat.mag*. */
export const UNPUBLISHED_MAG_STATS: MagStats = { power: 0, resist: 0 };

const PHYSICAL_DMG_TYPES = new Set([1, 256]);

export function magPowerForDmgType(pool: MagStats, dmgType: number): number {
  requireMagStats(pool, "Caster");
  if (PHYSICAL_DMG_TYPES.has(dmgType)) return 0;
  return pool.power;
}

export function magResistForDmgType(pool: MagStats, dmgType: number): number {
  requireMagStats(pool, "Target");
  if (PHYSICAL_DMG_TYPES.has(dmgType)) return 0;
  return pool.resist;
}

export function requireMagStats(stats: MagStats, label: string): void {
  requireNonNegative(stats.power, `${label} mag power`);
  requireNonNegative(stats.resist, `${label} mag resist`);
}

function requireNonNegative(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}
