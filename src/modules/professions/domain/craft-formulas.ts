import type { FarmRng } from "./farm-formulas.ts";

export const CRAFT_XP_BANDS: ReadonlyArray<{ delta: number; percent: number }> = [
  { delta: 8, percent: 90 },
  { delta: 18, percent: 50 },
  { delta: 28, percent: 25 },
  { delta: 38, percent: 15 },
  { delta: 48, percent: 5 },
  { delta: 60, percent: 3 },
];

function craftRecipeXpCap(skillValue: number, recipeMaxSkillValue: number): number {
  if (!Number.isInteger(skillValue) || skillValue < 0) {
    throw new Error("Recipe skillValue is required");
  }
  if (!Number.isInteger(recipeMaxSkillValue) || recipeMaxSkillValue < 1) {
    throw new Error("Recipe maxSkillValue is required");
  }
  return recipeMaxSkillValue;
}

export function craftTrainCap(
  skillValue: number,
  recipeMaxSkillValue: number,
  levelCap: number,
): number {
  if (!Number.isInteger(levelCap) || levelCap < 0) {
    throw new Error("Profession level cap is required");
  }
  return Math.min(craftRecipeXpCap(skillValue, recipeMaxSkillValue), levelCap);
}

export function rollCraftXp(
  current: number,
  skillValue: number,
  maxSkillValue: number,
  rng: FarmRng,
): boolean {
  if (current >= maxSkillValue) return false;
  const pct = craftXpChance(current, skillValue);
  if (pct <= 0) return false;
  return rng.unit() * 100 < pct;
}

function craftXpChance(current: number, skillValue: number): number {
  const delta = current - skillValue;
  for (const band of CRAFT_XP_BANDS) {
    if (band.delta > delta) return band.percent;
  }
  return 0;
}
