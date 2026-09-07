import { describe, expect, it } from "vitest";
import { Hero } from "../../../src/modules/character/domain/hero.ts";
import {
  buildUserUnitframe,
  type UnitframeHudPolicy,
} from "../../../src/modules/jugger-wire/application/user-unitframe-block.ts";

const hud: UnitframeHudPolicy = {
  rank: 0,
  fight_id: 0,
  gag_time: 0,
  hp_time: 0,
  mp_time: 0,
  epic_value: 0,
  mp: 12,
  mpMax: 12,
  exp: 1,
  expMin: 0,
  expMax: 68,
  expStatus: 0,
  honor: 0,
  honorMin: 0,
  honorMax: 100,
  honorStatus: 0,
  revenge: 0,
  revengeMin: 0,
  revengeMax: "300",
  revengeStatus: 0,
  energy_percent_max: 100,
  energy_percent_current: 100,
  avatar_small: "avatar_m_set_0_gray_sm.png",
};

describe("buildUserUnitframe", () => {
  it("uses live HUD keys with hero hpMax, not maxHp or id", () => {
    const hero = Hero.restore({
      id: 1,
      accountId: 1,
      nick: "Ada",
      level: 1,
      hp: 27,
      maxHp: 27,
      areaId: "503",
      moneyMinor: 2500,
    });
    const block = buildUserUnitframe(hero, hud);
    expect(block).toMatchObject({
      status: 100,
      nick: "Ada",
      level: 1,
      hp: 27,
      hpMax: 27,
      mp: 12,
      mpMax: 12,
      exp: 1,
      expMin: 0,
      expMax: 68,
      revengeMax: "300",
      avatar_small: "avatar_m_set_0_gray_sm.png",
      fight_id: 0,
    });
    expect(block).not.toHaveProperty("id");
    expect(block).not.toHaveProperty("maxHp");
  });

  it("fails when avatar_small is missing", () => {
    const hero = Hero.restore({
      id: 1,
      accountId: 1,
      nick: "Ada",
      level: 1,
      hp: 27,
      maxHp: 27,
      areaId: "503",
      moneyMinor: 2500,
    });
    expect(() => buildUserUnitframe(hero, { ...hud, avatar_small: "" })).toThrow(
      /avatar_small is required/,
    );
  });
});
