import { describe, expect, it } from "vitest";
import { maxProfessionSkillForLevel } from "../../../src/modules/character/domain/profession-cap.ts";

describe("maxProfessionSkillForLevel", () => {
  it("stays 0 below unlock, then 59 / 119", () => {
    expect(maxProfessionSkillForLevel(6)).toBe(0);
    expect(maxProfessionSkillForLevel(7)).toBe(59);
    expect(maxProfessionSkillForLevel(8)).toBe(59);
    expect(maxProfessionSkillForLevel(9)).toBe(119);
    expect(maxProfessionSkillForLevel(10)).toBe(119);
  });
});
