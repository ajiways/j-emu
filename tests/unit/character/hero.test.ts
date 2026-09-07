import { describe, expect, it } from "vitest";
import { Hero } from "../../../src/modules/character/domain/hero.ts";

describe("Hero", () => {
  it("requires an explicit valid creation policy", () => {
    expect(() =>
      Hero.assertCreationPolicy({
        level: 1,
        hp: 28,
        maxHp: 27,
        areaId: "503",
        moneyMinor: 2500,
      }),
    ).toThrow(/HP policy/);
  });

  it("uses every value from the supplied policy", () => {
    const policy = {
      level: 3,
      hp: 42,
      maxHp: 50,
      areaId: "777",
      moneyMinor: 1234,
    };
    Hero.assertCreationPolicy(policy);
    const hero = Hero.restore({
      id: "hero-1",
      accountId: "account",
      nick: "Hero",
      ...policy,
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
