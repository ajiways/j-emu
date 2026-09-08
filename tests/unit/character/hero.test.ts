import { describe, expect, it } from "vitest";
import { Hero } from "../../../src/modules/character/domain/hero.ts";
import { PLAYABLE_HERO_CREATION, testHero } from "../../support/hero-fixtures.ts";

describe("Hero", () => {
  it("requires an explicit valid creation policy", () => {
    expect(() =>
      Hero.assertCreationPolicy({
        ...PLAYABLE_HERO_CREATION,
        hp: 11,
        maxHp: 10,
      }),
    ).toThrow(/HP policy/);
  });

  it("uses every value from the supplied policy", () => {
    const policy = {
      ...PLAYABLE_HERO_CREATION,
      level: 3,
      hp: 42,
      maxHp: 50,
      areaId: "777",
      moneyMinor: 1234,
      skills: PLAYABLE_HERO_CREATION.skills.map((skill) =>
        skill.id === "VIT" ? { ...skill, value: 50 } : skill,
      ),
    };
    Hero.assertCreationPolicy(policy);
    const hero = testHero({
      level: 3,
      hp: 42,
      maxHp: 50,
      areaId: "777",
      moneyMinor: 1234,
    });
    expect({
      level: hero.level,
      hp: hero.hp,
      maxHp: hero.maxHp,
      areaId: hero.areaId,
      moneyMinor: hero.moneyMinor,
    }).toEqual({ level: 3, hp: 42, maxHp: 50, areaId: "777", moneyMinor: 1234 });
  });
});
