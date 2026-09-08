import type { Clock } from "../../../shared/kernel/clock.ts";
import { ClockRegressionError } from "./clock-regression-error.ts";
import { MissingHpregError } from "./missing-hpreg-error.ts";

export type ElapsedHpRegenInput = Readonly<{
  hp: number;
  hpMax: number;
  regenAtSec: number;
  nowSec: number;
  hpreg: number;
  k: number;
  characterId: number;
}>;

export type ElapsedHpRegenResult = Readonly<{
  hp: number;
  hpTime: number;
}>;

export function truncatedUnixDate(clock: Clock): Date {
  return new Date(clock.unixSeconds() * 1000);
}

export function unixSecondsOf(value: Date): number {
  const ms = value.getTime();
  if (!Number.isFinite(ms)) throw new Error("regen_at is not a valid timestamp");
  return Math.floor(ms / 1000);
}

export function remainingHpSeconds(
  deficit: number,
  hpreg: number,
  k: number,
  characterId: number,
): number {
  if (deficit <= 0) return 0;
  requirePositiveRegenK(k);
  requirePositiveHpreg(hpreg, characterId);
  return Math.max(1, Math.round((deficit * k) / hpreg));
}

export function applyElapsedHpRegen(input: ElapsedHpRegenInput): ElapsedHpRegenResult {
  requirePositiveRegenK(input.k);
  if (input.nowSec < input.regenAtSec) {
    throw new ClockRegressionError(input.nowSec, input.regenAtSec);
  }
  if (!Number.isInteger(input.hpMax) || input.hpMax < 1) {
    throw new Error("Hero maxHp must be a positive integer");
  }
  if (!Number.isInteger(input.hp) || input.hp < 0 || input.hp > input.hpMax) {
    throw new Error("Hero HP must be an integer in [0, maxHp]");
  }
  const elapsed = input.nowSec - input.regenAtSec;
  let hp = input.hp;
  if (hp < input.hpMax) {
    requirePositiveHpreg(input.hpreg, input.characterId);
    if (elapsed > 0) {
      hp = Math.min(input.hpMax, Math.floor(hp + (input.hpreg / input.k) * elapsed));
    }
  }
  return {
    hp,
    hpTime: remainingHpSeconds(input.hpMax - hp, input.hpreg, input.k, input.characterId),
  };
}

function requirePositiveRegenK(k: number): void {
  if (!Number.isInteger(k) || k < 1) {
    throw new Error("RegenPolicy.k must be a positive integer");
  }
}

function requirePositiveHpreg(hpreg: number, characterId: number): void {
  if (!Number.isInteger(hpreg) || hpreg < 1) {
    throw new MissingHpregError(characterId);
  }
}
