import { describe, expect, it } from "vitest";
import { ArtifactSkillBonus } from "../../../src/modules/catalog/domain/artifact-skill-bonus.ts";
import {
  requiredSkillTotal,
  totalHeroSkills,
} from "../../../src/modules/character/domain/equipment-skill-totals.ts";

describe("equipment skill totals", () => {
  it("adds flat glove bonuses onto naked L1 combat skills", () => {
    const totals = totalHeroSkills(
      [
        { id: "STR", value: 12 },
        { id: "VIT", value: 10 },
        { id: "MPMAX", value: 12 },
      ],
      [new ArtifactSkillBonus("STR", 6, 0), new ArtifactSkillBonus("VIT", 5, 0)],
    );
    expect(requiredSkillTotal(totals, "STR")).toBe(18);
    expect(requiredSkillTotal(totals, "VIT")).toBe(15);
    expect(requiredSkillTotal(totals, "MPMAX")).toBe(12);
  });

  it("applies percent flags after flat bonuses", () => {
    const totals = totalHeroSkills(
      [{ id: "VIT", value: 10 }],
      [new ArtifactSkillBonus("VIT", 20, 1)],
    );
    expect(requiredSkillTotal(totals, "VIT")).toBe(12);
  });

  it("fails when VIT is missing from totals", () => {
    expect(() => requiredSkillTotal([{ id: "STR", value: 12 }], "VIT")).toThrow(/VIT is missing/);
  });
});
