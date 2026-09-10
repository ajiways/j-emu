const PROFESSION_UNLOCK_LEVEL = 7;
const PROFESSION_CAP_BASE = 59;
const PROFESSION_CAP_STEP = 60;
const PROFESSION_CAP_EVERY_LEVELS = 2;
const PROFESSION_CAP_HARD = 900;

export function maxProfessionSkillForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error("Hero level must be a positive integer");
  }
  if (level < PROFESSION_UNLOCK_LEVEL) return 0;
  const steps = Math.floor((level - PROFESSION_UNLOCK_LEVEL) / PROFESSION_CAP_EVERY_LEVELS);
  return Math.min(PROFESSION_CAP_HARD, PROFESSION_CAP_BASE + PROFESSION_CAP_STEP * steps);
}
