import { describe, expect, it } from "vitest";
import { AppearancePreset } from "../../../src/modules/catalog/domain/appearance-preset.ts";
import { HudDefaults } from "../../../src/modules/catalog/domain/hud-defaults.ts";
import { LevelBoundary } from "../../../src/modules/catalog/domain/level-boundary.ts";
import { buildUserUnitframe } from "../../../src/modules/jugger-wire/application/user-unitframe-block.ts";
import { testHero } from "../../support/hero-fixtures.ts";

const level = new LevelBoundary(1, 0, 68, 2, 0, 0, 100, 0);
const appearance = new AppearancePreset(
  1,
  1,
  "avatar_m_set_0_gray.png",
  "avatar_m_set_0_gray_sm.png",
);
const hud = new HudDefaults(0, 0, 0, 0, 0, 0, 0, "300", 0, 100, 100, 0, 0);

describe("buildUserUnitframe", () => {
  it("uses live HUD keys with hero hpMax, not maxHp or id", () => {
    const block = buildUserUnitframe(testHero({ nick: "Ada" }), level, appearance, hud);
    expect(block).toMatchObject({
      status: 100,
      nick: "Ada",
      level: 1,
      hp: 10,
      hpMax: 10,
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
    expect(() => new AppearancePreset(1, 1, "avatar_m_set_0_gray.png", "")).toThrow(
      /avatar_small is required/,
    );
  });
});
