import { describe, expect, it } from "vitest";
import { ArtifactSkillBonus } from "../../../src/modules/catalog/domain/artifact-skill-bonus.ts";
import {
  canItemBeUpgraded,
  canResonateItem,
  overlayPrimaryBonus,
  overlaySkillBonuses,
  pickUpgradeSkill,
  rollUpgradeSuccess,
  upgradeBonusTotal,
  upgradeChance,
  upgradeSkillPool,
} from "../../../src/modules/inventory/domain/gear-upgrade.ts";
import {
  UPGRADE_TYPE_ACTUAL,
  UPGRADE_TYPE_ACTUAL_100,
  UPGRADE_TYPE_LEGACY,
  upgradeTypesCompatible,
} from "../../../src/modules/inventory/domain/upgrade-tables.ts";

const chestSkills = [
  new ArtifactSkillBonus("DEF", 2, 0),
  new ArtifactSkillBonus("DEX", 2, 0),
  new ArtifactSkillBonus("RAG", 1, 0),
  new ArtifactSkillBonus("STR", 7, 0),
  new ArtifactSkillBonus("VIT", 6, 0),
];

describe("gear upgrade formulas", () => {
  it("uses dump-proven chance and ceil(base × mult) bonus", () => {
    expect(upgradeChance(UPGRADE_TYPE_ACTUAL, 1)).toBe(90);
    expect(upgradeChance(UPGRADE_TYPE_ACTUAL_100, 6)).toBe(100);
    expect(upgradeBonusTotal(UPGRADE_TYPE_ACTUAL, 1, 7)).toBe(2);
    expect(upgradeBonusTotal(UPGRADE_TYPE_LEGACY, 1, 7)).toBe(2);
  });

  it("treats types 2 and 3 as one lineage and rejects 1 vs 2", () => {
    expect(upgradeTypesCompatible(0, UPGRADE_TYPE_ACTUAL)).toBe(true);
    expect(upgradeTypesCompatible(UPGRADE_TYPE_ACTUAL, UPGRADE_TYPE_ACTUAL_100)).toBe(true);
    expect(upgradeTypesCompatible(UPGRADE_TYPE_LEGACY, UPGRADE_TYPE_ACTUAL)).toBe(false);
  });

  it("allows paperdoll combat gear below level 6 and resonator only with a pool", () => {
    const opts = {
      typeId: "2",
      kindId: 20,
      skills: chestSkills,
      upgradeId: 0,
      upgradeLevel: 0,
      slotMask: 2,
    };
    expect(canItemBeUpgraded(opts)).toBe(true);
    expect(canResonateItem({ ...opts, upgradeId: 2, upgradeLevel: 1 })).toBe(true);
    expect(canResonateItem(opts)).toBe(false);
    expect(canItemBeUpgraded({ ...opts, slotMask: 0 })).toBe(false);
  });

  it("re-picks the combat stat without changing level math", () => {
    const pool = upgradeSkillPool(chestSkills);
    expect(pool.map((row) => row.skillId)).toEqual(["DEF", "DEX", "RAG", "STR", "VIT"]);
    expect(pickUpgradeSkill(pool, () => 0, "DEF")).toBe("DEX");
  });

  it("fails a roll at chance 90 when unit is 0.9", () => {
    expect(rollUpgradeSuccess(90, () => 0)).toBe(true);
    expect(rollUpgradeSuccess(90, () => 0.9)).toBe(false);
    expect(rollUpgradeSuccess(100, () => 0.99)).toBe(true);
  });

  it("overlays catalog + bonus and named extras at level 6", () => {
    const overlay = overlaySkillBonuses(chestSkills, {
      id: UPGRADE_TYPE_ACTUAL,
      level: 6,
      skillId: "STR",
      bound: true,
    });
    const str = overlay.find((row) => row.id === "STR");
    expect(str?.value).toBe(
      7 +
        overlayPrimaryBonus(chestSkills, {
          id: UPGRADE_TYPE_ACTUAL,
          level: 6,
          skillId: "STR",
          bound: true,
        }),
    );
    expect(overlay.some((row) => row.id === "INJ_PROB")).toBe(true);
    expect(overlay.some((row) => row.id === "BLOK")).toBe(true);
    expect(overlay.some((row) => row.id === "BLOK_VISUAL")).toBe(true);
  });
});
