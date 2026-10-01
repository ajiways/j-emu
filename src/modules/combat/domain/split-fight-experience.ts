import { scaleIntReward, overlevel } from "./overlevel.ts";

export type DamageShare = Readonly<{
  characterId: number;
  damage: number;
  level: number;
}>;

export function rankDamageShares(shares: readonly DamageShare[]): DamageShare[] {
  return [...shares]
    .filter((share) => share.damage > 0)
    .sort((left, right) => right.damage - left.damage || left.characterId - right.characterId);
}

/**
 * Experience by share of the damage dealt to the mob. Allied mobs (`alliedDamage`) take their
 * part of the pool without being paid, and the rounding dust goes to the top damager only when
 * he is a player.
 */
export function splitFightExperience(
  baseExp: number,
  botLevel: number,
  shares: readonly DamageShare[],
  alliedDamage: readonly number[],
): ReadonlyMap<number, number> {
  if (!Number.isInteger(baseExp) || baseExp < 0) throw new Error("baseExp is invalid");
  const attackers = rankDamageShares(shares);
  const granted = new Map<number, number>();
  if (attackers.length === 0 || baseExp < 1) return granted;
  const alliedTotal = alliedDamage.reduce((sum, damage) => sum + damage, 0);
  const totalDamage = attackers.reduce((sum, share) => sum + share.damage, 0) + alliedTotal;
  let givenShare = alliedDamage.reduce(
    (sum, damage) => sum + Math.floor((baseExp * damage) / totalDamage),
    0,
  );
  for (const share of attackers) {
    const raw = Math.floor((baseExp * share.damage) / totalDamage);
    givenShare += raw;
    const amount = scaleIntReward(raw, overlevel(share.level, botLevel));
    if (amount >= 1) granted.set(share.characterId, (granted.get(share.characterId) ?? 0) + amount);
  }
  const remainder = baseExp - givenShare;
  const top = attackers[0];
  if (remainder > 0 && top && top.damage >= Math.max(0, ...alliedDamage)) {
    const extra = scaleIntReward(remainder, overlevel(top.level, botLevel));
    if (extra >= 1) granted.set(top.characterId, (granted.get(top.characterId) ?? 0) + extra);
  }
  return granted;
}

/**
 * Who the money and the drop of a won fight go to: the player who dealt the most, unless a mob of
 * his own side dealt more (then nobody). A win nobody on the side damaged is not a valid fight.
 */
export function rewardedTopDamager(
  shares: readonly DamageShare[],
  alliedDamage: readonly number[],
): DamageShare | undefined {
  const topHuman = rankDamageShares(shares)[0];
  const topAlly = Math.max(0, ...alliedDamage);
  if (topHuman === undefined && topAlly === 0) throw new Error("Hunt win is missing a top damager");
  return topHuman !== undefined && topHuman.damage >= topAlly ? topHuman : undefined;
}
