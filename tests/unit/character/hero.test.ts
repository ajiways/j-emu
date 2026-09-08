import { describe, expect, it } from "vitest";
import { Hero } from "../../../src/modules/character/domain/hero.ts";
import { PLAYABLE_HERO_CREATION, testHero } from "../../support/hero-fixtures.ts";

describe("Hero", () => {
  it("requires an explicit valid creation policy", () => {
    expect(() =>
      Hero.assertCreationPolicy({
        ...PLAYABLE_HERO_CREATION,
        exp: 0,
      }),
    ).toThrow(/EXP must be 1/);
    expect(() =>
      Hero.assertCreationPolicy({
        ...PLAYABLE_HERO_CREATION,
        skills: [...PLAYABLE_HERO_CREATION.skills, { id: "VIT", value: 10 }],
      }),
    ).toThrow(/managed skill VIT/);
  });

  it("uses every value from the supplied restore record", () => {
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

  it("keeps a zero resource at zero when maxima change", () => {
    const hero = testHero({ hp: 0, maxHp: 10, mp: 0, maxMp: 12 });
    hero.applyProgression(68, 2, 11, 13);
    expect(hero.hp).toBe(0);
    expect(hero.mp).toBe(0);
    expect(hero.level).toBe(2);
    expect(hero.exp).toBe(68);
    expect(hero.maxHp).toBe(11);
    expect(hero.maxMp).toBe(13);
  });
});
