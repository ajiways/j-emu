import { MissingMpregError } from "./missing-mpreg-error.ts";

export type ElapsedMpRegenInput = Readonly<{
  mp: number;
  mpMax: number;
  regenAtSec: number;
  nowSec: number;
  mpreg: number;
  mpK: number;
  characterId: number;
}>;

export type ElapsedMpRegenResult = Readonly<{
  mp: number;
  mpTime: number;
  /** The second the next whole point of mana counts from; the fraction already earned is kept. */
  regenAtSec: number;
}>;

/** Seconds to full mana: `deficit · mpK / MPREG`, at least one while mana is missing. */
export function remainingMpSeconds(
  deficit: number,
  mpreg: number,
  mpK: number,
  characterId: number,
): number {
  if (deficit <= 0) return 0;
  requirePositiveMpK(mpK);
  requirePositiveMpreg(mpreg, characterId);
  return Math.max(1, Math.round((deficit * mpK) / mpreg));
}

/** Mana regained outside a fight since `regenAtSec`: `MPREG / mpK` points a second. */
export function applyElapsedMpRegen(input: ElapsedMpRegenInput): ElapsedMpRegenResult {
  requirePositiveMpK(input.mpK);
  if (input.nowSec < input.regenAtSec) {
    throw new Error(`Mana clock ${input.regenAtSec} is ahead of now ${input.nowSec}`);
  }
  if (!Number.isInteger(input.mpMax) || input.mpMax < 1) {
    throw new Error("Hero maxMp must be a positive integer");
  }
  if (!Number.isInteger(input.mp) || input.mp < 0 || input.mp > input.mpMax) {
    throw new Error("Hero MP must be an integer in [0, maxMp]");
  }
  if (input.mp === input.mpMax) {
    return { mp: input.mp, mpTime: 0, regenAtSec: input.nowSec };
  }
  requirePositiveMpreg(input.mpreg, input.characterId);
  const gained = Math.floor(((input.nowSec - input.regenAtSec) * input.mpreg) / input.mpK);
  const mp = Math.min(input.mpMax, input.mp + gained);
  const spentSec = Math.floor((gained * input.mpK) / input.mpreg);
  return {
    mp,
    mpTime: remainingMpSeconds(input.mpMax - mp, input.mpreg, input.mpK, input.characterId),
    regenAtSec: mp === input.mpMax ? input.nowSec : input.regenAtSec + spentSec,
  };
}

function requirePositiveMpK(mpK: number): void {
  if (!Number.isInteger(mpK) || mpK < 1) {
    throw new Error("RegenPolicy.mpK must be a positive integer");
  }
}

function requirePositiveMpreg(mpreg: number, characterId: number): void {
  if (!Number.isInteger(mpreg) || mpreg < 1) throw new MissingMpregError(characterId);
}
