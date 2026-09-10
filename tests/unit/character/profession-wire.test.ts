import { describe, expect, it } from "vitest";
import { maxProfessionSkillForLevel } from "../../../src/modules/character/domain/profession-cap.ts";
import { userProfessionsWire } from "../../../src/modules/character/domain/profession-wire.ts";

describe("profession cap and wire", () => {
  it("keeps cap 0 below level 7 and follows the dump 59/119 steps", () => {
    expect(maxProfessionSkillForLevel(6)).toBe(0);
    expect(maxProfessionSkillForLevel(7)).toBe(59);
    expect(maxProfessionSkillForLevel(8)).toBe(59);
    expect(maxProfessionSkillForLevel(9)).toBe(119);
    expect(maxProfessionSkillForLevel(39)).toBe(900);
  });

  it("sends 16 empty slots and cap 0 when nothing is licensed", () => {
    expect(userProfessionsWire([], 7)).toEqual({
      status: 100,
      professions: Array.from({ length: 16 }, () => ({ value: 0 })),
      max_profession_skill: 0,
    });
  });

  it("places licenses at id-1 and unlocks the level cap", () => {
    const block = userProfessionsWire(
      [
        { professionId: 2, value: 1 },
        { professionId: 6, value: 1 },
      ],
      7,
    );
    expect(block.max_profession_skill).toBe(59);
    expect(block.professions[1]).toEqual({ id: 2, active: true, value: 1 });
    expect(block.professions[5]).toEqual({ id: 6, active: true, value: 1 });
  });
});
