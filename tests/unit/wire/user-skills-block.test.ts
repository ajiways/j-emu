import { describe, expect, it } from "vitest";
import { SkillDefinition } from "../../../src/modules/catalog/domain/skill-definition.ts";
import { buildUserSkills } from "../../../src/modules/jugger-wire/application/user-skills-block.ts";

describe("buildUserSkills", () => {
  it("omits zero MONEYMOD and stringifies HPREG", () => {
    const definitions = new Map([
      ["VIT", new SkillDefinition("VIT", "Здоровье", "1", "0", "950", "", "number")],
      [
        "HPREG",
        new SkillDefinition("HPREG", "Скорость регенерации", "6", "0", "900", "", "string"),
      ],
      [
        "MONEYMOD",
        new SkillDefinition("MONEYMOD", "Увеличенный дроп денег", "6", "0", "300", "", "number"),
      ],
    ]);
    const block = buildUserSkills(
      [
        { id: "VIT", value: 10 },
        { id: "HPREG", value: 700 },
        { id: "MONEYMOD", value: 0 },
      ],
      definitions,
      20,
    );
    expect(block.amount_max).toBe(20);
    expect(block.skills.map((skill) => skill.id)).toEqual(["VIT", "HPREG"]);
    expect(block.skills[1]?.value).toBe("700");
  });

  it("fails when a skill catalog row is missing", () => {
    expect(() => buildUserSkills([{ id: "VIT", value: 10 }], new Map(), 20)).toThrow(
      /Skill catalog entry VIT is missing/,
    );
  });
});
