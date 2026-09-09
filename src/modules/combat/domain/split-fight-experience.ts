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

export function splitFightExperience(
  baseExp: number,
  botLevel: number,
  shares: readonly DamageShare[],
): ReadonlyMap<number, number> {
  if (!Number.isInteger(baseExp) || baseExp < 0) throw new Error("baseExp is invalid");
  const attackers = rankDamageShares(shares);
  const granted = new Map<number, number>();
  if (attackers.length === 0 || baseExp < 1) return granted;
  const totalDamage = attackers.reduce((sum, share) => sum + share.damage, 0);
  let givenShare = 0;
  for (const share of attackers) {
    const raw = Math.floor((baseExp * share.damage) / totalDamage);
    givenShare += raw;
    const amount = scaleIntReward(raw, overlevel(share.level, botLevel));
    if (amount >= 1) granted.set(share.characterId, (granted.get(share.characterId) ?? 0) + amount);
  }
  const remainder = baseExp - givenShare;
  const top = attackers[0];
  if (remainder > 0 && top) {
    const extra = scaleIntReward(remainder, overlevel(top.level, botLevel));
    if (extra >= 1) granted.set(top.characterId, (granted.get(top.characterId) ?? 0) + extra);
  }
  return granted;
}
