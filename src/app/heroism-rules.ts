export type HeroismRules = Readonly<{
  baseByLevel: readonly number[];
  winMultiplier: 1.4;
  loseMultiplier: 0.8;
  /** Heroism of a healed hit point against one of damage: 10 damage pay 2, 10 healed pay 1. */
  healShare: 0.5;
}>;

export const HEROISM_RULES: HeroismRules = {
  baseByLevel: [
    10, 11, 12, 13, 14, 15, 16, 18, 19, 21, 23, 25, 27, 29, 32, 34, 36, 38, 40, 42, 44, 47, 49, 52,
    55, 58, 61, 64, 68, 72, 75, 80, 84, 89, 94,
  ],
  winMultiplier: 1.4,
  loseMultiplier: 0.8,
  healShare: 0.5,
};

export type HonorVictim = Readonly<{
  dmgToVictim: number;
  victimLevel: number;
  victimHpMax: number;
}>;

/**
 * Heroism of one fighter for a fight: the damage he dealt to each human, rated per victim, plus
 * what he healed in the other humans (`dmgToVictim` is the healed amount there) at `healShare`.
 */
export function rawHonorFromVictims(
  victims: readonly HonorVictim[],
  won: boolean,
  rules: HeroismRules,
  healed: readonly HonorVictim[],
): number {
  if (rules.baseByLevel.length !== 35) {
    throw new Error("HeroismRules.baseByLevel must have 35 entries for levels 1..35");
  }
  if (rules.winMultiplier !== 1.4) throw new Error("HeroismRules.winMultiplier must be 1.4");
  if (rules.loseMultiplier !== 0.8) throw new Error("HeroismRules.loseMultiplier must be 0.8");
  if (rules.healShare !== 0.5) throw new Error("HeroismRules.healShare must be 0.5");
  let sum = 0;
  const rated = [
    ...victims.map((victim) => ({ ...victim, share: 1 })),
    ...healed.map((victim) => ({ ...victim, share: rules.healShare })),
  ];
  for (const victim of rated) {
    if (
      !Number.isInteger(victim.victimLevel) ||
      victim.victimLevel < 1 ||
      victim.victimLevel > rules.baseByLevel.length
    ) {
      throw new Error(`Heroism victim level ${victim.victimLevel} is outside 1..35`);
    }
    if (!Number.isInteger(victim.victimHpMax) || victim.victimHpMax < 1) {
      throw new Error("Heroism victim maxHp must be a positive integer");
    }
    if (!Number.isInteger(victim.dmgToVictim) || victim.dmgToVictim < 0) {
      throw new Error("Heroism damage must be a non-negative integer");
    }
    const base = rules.baseByLevel[victim.victimLevel - 1];
    if (base === undefined) {
      throw new Error(`Heroism base for level ${victim.victimLevel} is missing`);
    }
    sum += (victim.share * base * victim.dmgToVictim) / victim.victimHpMax;
  }
  return Math.round(sum * (won ? rules.winMultiplier : rules.loseMultiplier));
}

/** One victim: the same as `rawHonorFromVictims` with a single entry. */
export function rawHonorFromDamage(
  opts: Readonly<{
    dmgToVictim: number;
    victimLevel: number;
    victimHpMax: number;
    won: boolean;
  }>,
  rules: HeroismRules,
): number {
  return rawHonorFromVictims([opts], opts.won, rules, []);
}
