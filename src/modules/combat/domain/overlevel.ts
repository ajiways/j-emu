/** First extra level is free: 0–1 → 100%, then −20% per level, 0 at 6+. */
export function overlevel(playerLevel: number, mobLevel: number): number {
  if (!Number.isInteger(playerLevel) || playerLevel < 1) {
    throw new Error("Player level is invalid");
  }
  if (!Number.isInteger(mobLevel) || mobLevel < 1) throw new Error("Mob level is invalid");
  return Math.max(0, playerLevel - mobLevel);
}

export function overlevelRewardBp(over: number): number {
  if (!Number.isInteger(over) || over < 0) throw new Error("Overlevel is invalid");
  return Math.max(0, 10_000 - 2_000 * Math.max(0, over - 1));
}

export function scaleIntReward(value: number, over: number): number {
  if (!Number.isInteger(value) || value < 0) throw new Error("Reward value is invalid");
  return Math.floor((value * overlevelRewardBp(over)) / 10_000);
}

export function scaleMoneyReward(gold: number, over: number): number {
  if (!Number.isFinite(gold) || gold < 0) throw new Error("Gold amount is invalid");
  const cents = Math.round(gold * 100);
  if (cents < 1) return 0;
  return Math.floor((cents * overlevelRewardBp(over)) / 10_000) / 100;
}

export function worldLootAllowed(over: number): boolean {
  return over < 2;
}
