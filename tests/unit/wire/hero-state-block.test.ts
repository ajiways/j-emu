import { describe, expect, it } from "vitest";
import { FIGHT_INJURY_ARTIKUL_ID } from "../../../src/modules/character/domain/fight-injury-wire.ts";
import { buildHeroState } from "../../../src/modules/jugger-wire/application/hero-state-block.ts";
import { FakeClock } from "../../support/fake-clock.ts";
import { testHero } from "../../support/hero-fixtures.ts";

const START_MS = 1_700_000_000_000;

describe("buildHeroState", () => {
  it("omits fight_id when idle and overlays it in a fight", () => {
    const clock = new FakeClock(START_MS);
    const idle = buildHeroState(testHero(), clock, {
      fightId: null,
      newMessage: 0,
      inParty: false,
    });
    expect(idle).not.toHaveProperty("fight_id");
    const fighting = buildHeroState(testHero(), clock, {
      fightId: 9,
      newMessage: 0,
      inParty: false,
    });
    expect(fighting.fight_id).toBe(9);
  });

  it("adds ghost resurrect fields only while ghosted", () => {
    const clock = new FakeClock(START_MS);
    const hero = testHero({ hp: 0, maxHp: 10 });
    hero.applyDefeat(Math.floor(START_MS / 1000) + 600, new Date(START_MS));
    const state = buildHeroState(hero, clock, {
      fightId: null,
      resurrectZoneId: "503",
      resurrectZoneTitle: "Горное поселение",
      newMessage: 0,
      inParty: false,
    });
    expect(state).toMatchObject({
      ghost: 1,
      resurrect_time: 0,
      injury: "1",
      resurrect_zones: { "503": { title: "Горное поселение" } },
    });
    expect(hero.injuryArtikulId).toBe(FIGHT_INJURY_ARTIKUL_ID);
  });

  it("offers outdoor temple 503 while the ghost still stands in 501", () => {
    const clock = new FakeClock(START_MS);
    const hero = testHero({ hp: 0, maxHp: 10, areaId: "501" });
    hero.applyDefeat(Math.floor(START_MS / 1000) + 600, new Date(START_MS));
    const state = buildHeroState(hero, clock, {
      fightId: null,
      resurrectZoneId: "503",
      resurrectZoneTitle: "Горное поселение",
      newMessage: 0,
      inParty: false,
    });
    expect(state.area_id).toBe("501");
    expect(state.resurrect_zones).toEqual({ "503": { title: "Горное поселение" } });
  });
});
