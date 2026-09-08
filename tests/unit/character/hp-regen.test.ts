import { describe, expect, it } from "vitest";
import { ClockRegressionError } from "../../../src/modules/character/domain/clock-regression-error.ts";
import {
  applyElapsedHpRegen,
  remainingHpSeconds,
} from "../../../src/modules/character/domain/hp-regen.ts";
import { MissingHpregError } from "../../../src/modules/character/domain/missing-hpreg-error.ts";
import { PLAYABLE_REGEN_POLICY } from "../../support/hero-fixtures.ts";

const K = PLAYABLE_REGEN_POLICY.k;

describe("remainingHpSeconds", () => {
  it("matches HP_REGEN.md samples at HPREG=300", () => {
    expect(remainingHpSeconds(42, 300, K, 1)).toBe(35);
    expect(remainingHpSeconds(40, 300, K, 1)).toBe(33);
    expect(remainingHpSeconds(14, 300, K, 1)).toBe(12);
    expect(remainingHpSeconds(2, 300, K, 1)).toBe(2);
  });

  it("floors remaining seconds to 1 for deficit 1 at HPREG 700", () => {
    expect(remainingHpSeconds(1, 700, K, 1)).toBe(1);
  });

  it("returns 0 at full HP without requiring HPREG", () => {
    expect(remainingHpSeconds(0, 0, K, 1)).toBe(0);
    expect(remainingHpSeconds(-1, 0, K, 1)).toBe(0);
  });

  it("fails when HPREG is missing while wounded", () => {
    expect(() => remainingHpSeconds(1, 0, K, 9)).toThrow(MissingHpregError);
  });
});

describe("applyElapsedHpRegen", () => {
  it("does not change full HP", () => {
    expect(
      applyElapsedHpRegen({
        hp: 50,
        hpMax: 50,
        regenAtSec: 1_700_000_000,
        nowSec: 1_700_000_030,
        hpreg: 0,
        k: K,
        characterId: 1,
      }),
    ).toEqual({ hp: 50, hpTime: 0 });
  });

  it("clears leftover hp_time at full HP", () => {
    expect(
      applyElapsedHpRegen({
        hp: 50,
        hpMax: 50,
        regenAtSec: 1_700_000_000,
        nowSec: 1_700_000_000,
        hpreg: 700,
        k: K,
        characterId: 1,
      }),
    ).toEqual({ hp: 50, hpTime: 0 });
  });

  it("gains whole HP after enough elapsed seconds", () => {
    expect(
      applyElapsedHpRegen({
        hp: 10,
        hpMax: 50,
        regenAtSec: 1_700_000_000,
        nowSec: 1_700_000_002,
        hpreg: 250,
        k: K,
        characterId: 1,
      }),
    ).toEqual({ hp: 12, hpTime: remainingHpSeconds(38, 250, K, 1) });
  });

  it("regenerates 0 HP as a normal deficit", () => {
    const next = applyElapsedHpRegen({
      hp: 0,
      hpMax: 50,
      regenAtSec: 1_700_000_000,
      nowSec: 1_700_000_000,
      hpreg: 250,
      k: K,
      characterId: 1,
    });
    expect(next.hp).toBe(0);
    expect(next.hpTime).toBe(remainingHpSeconds(50, 250, K, 1));
  });

  it("rejects clock regression instead of clamping elapsed", () => {
    expect(() =>
      applyElapsedHpRegen({
        hp: 10,
        hpMax: 50,
        regenAtSec: 1_700_000_010,
        nowSec: 1_700_000_000,
        hpreg: 250,
        k: K,
        characterId: 1,
      }),
    ).toThrow(ClockRegressionError);
  });
});
