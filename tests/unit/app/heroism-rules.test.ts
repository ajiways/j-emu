import { describe, expect, it } from "vitest";
import {
  HEROISM_RULES,
  rawHonorFromDamage,
  rawHonorFromVictims,
} from "../../../src/app/heroism-rules.ts";

describe("rawHonorFromDamage", () => {
  it("matches dump pairs at hpMax 108/111 without level_penalty", () => {
    expect(
      rawHonorFromDamage(
        { dmgToVictim: 350, victimLevel: 6, victimHpMax: 108, won: true },
        HEROISM_RULES,
      ),
    ).toBe(68);
    expect(
      rawHonorFromDamage(
        { dmgToVictim: 222, victimLevel: 7, victimHpMax: 111, won: false },
        HEROISM_RULES,
      ),
    ).toBe(26);
    expect(
      rawHonorFromDamage(
        { dmgToVictim: 215, victimLevel: 6, victimHpMax: 108, won: true },
        HEROISM_RULES,
      ),
    ).toBe(42);
  });

  it("uses Base 15 at L6 and Base 16 at L7", () => {
    expect(
      rawHonorFromDamage(
        { dmgToVictim: 108, victimLevel: 6, victimHpMax: 108, won: true },
        HEROISM_RULES,
      ),
    ).toBe(21);
    expect(
      rawHonorFromDamage(
        { dmgToVictim: 111, victimLevel: 7, victimHpMax: 111, won: true },
        HEROISM_RULES,
      ),
    ).toBe(22);
  });

  it("fails closed for victim level and maxHp outside the table", () => {
    expect(() =>
      rawHonorFromDamage(
        { dmgToVictim: 10, victimLevel: 0, victimHpMax: 108, won: true },
        HEROISM_RULES,
      ),
    ).toThrow(/outside 1\.\.35/);
    expect(() =>
      rawHonorFromDamage(
        { dmgToVictim: 10, victimLevel: 36, victimHpMax: 108, won: true },
        HEROISM_RULES,
      ),
    ).toThrow(/outside 1\.\.35/);
    expect(() =>
      rawHonorFromDamage(
        { dmgToVictim: 10, victimLevel: 6, victimHpMax: 0, won: true },
        HEROISM_RULES,
      ),
    ).toThrow(/maxHp must be a positive integer/);
  });
});

describe("rawHonorFromVictims", () => {
  it("rates the damage per victim and rounds the sum once", () => {
    const victims = [
      { dmgToVictim: 108, victimLevel: 6, victimHpMax: 108 },
      { dmgToVictim: 111, victimLevel: 7, victimHpMax: 111 },
    ];
    // (15 + 16) × 1.4 = 43.4; rounding each victim first would give 21 + 22 = 43.
    expect(rawHonorFromVictims(victims, true, HEROISM_RULES)).toBe(43);
    expect(rawHonorFromVictims(victims, false, HEROISM_RULES)).toBe(25);
  });

  it("is nothing without a human victim", () => {
    expect(rawHonorFromVictims([], true, HEROISM_RULES)).toBe(0);
  });
});
