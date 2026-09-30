import { describe, expect, it } from "vitest";
import { takenDamage } from "../../../src/modules/combat/domain/damage-intake.ts";

const PHYSICAL = 1;
const POISON = 64;
const DEATH_SIGN = 256;

describe("takenDamage", () => {
  it("keeps the DFR share of a physical hit out and the MAG_DFR share of a magic one", () => {
    const crush = [{ skills: { DFR: 0.4, MAG_DFR: 0.4 } }];
    expect(takenDamage(crush, 10, PHYSICAL)).toBe(6);
    expect(takenDamage(crush, 10, POISON)).toBe(6);
    const armor = [{ skills: { DFR: 1 } }];
    expect(takenDamage(armor, 10, PHYSICAL)).toBe(0);
    expect(takenDamage(armor, 10, POISON)).toBe(10);
  });

  it("lets death signs through DFR and MAG_DFR", () => {
    expect(takenDamage([{ skills: { DFR: 1, MAG_DFR: 1 } }], 7, DEATH_SIGN)).toBe(7);
  });

  it("applies an effect only to the damage types of its mask", () => {
    const masked = [{ dmgMask: 1, skills: { DFR: 0.5, MAG_DFR: 0.5 } }];
    expect(takenDamage(masked, 10, PHYSICAL)).toBe(5);
    expect(takenDamage(masked, 10, POISON)).toBe(10);
  });

  it("takes ADFR off the final figure, every type, and stacks effects by multiplying", () => {
    const shield = [{ skills: { ADFR: 0.3 } }, { skills: { ADFR: 0.5 } }];
    expect(takenDamage(shield, 100, POISON)).toBe(35);
    expect(takenDamage([{ skills: { ADFR: 1 } }], 100, PHYSICAL)).toBe(0);
  });

  it("makes the carrier take more with DMG_AMP and pcDMG_AMP", () => {
    expect(takenDamage([{ skills: { DMG_AMP: 0.23 } }], 100, PHYSICAL)).toBe(123);
    expect(takenDamage([{ skills: { pcDMG_AMP: 50 } }], 10, POISON)).toBe(15);
  });

  it("never rounds a hit that still lands down to nothing", () => {
    expect(takenDamage([{ skills: { DFR: 0.9 } }], 1, PHYSICAL)).toBe(1);
  });

  it("leaves a hit alone when nothing stands on the carrier", () => {
    expect(takenDamage([], 12, PHYSICAL)).toBe(12);
  });
});
