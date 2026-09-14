import { describe, expect, it } from "vitest";
import {
  overlevel,
  overlevelRewardBp,
  scaleIntReward,
  scaleMoneyReward,
  worldLootAllowed,
} from "../../../src/modules/combat/domain/overlevel.ts";
import {
  goldToMinor,
  goldWireString,
  rollMoneyGold,
} from "../../../src/modules/combat/domain/fight-money.ts";
import {
  rankDamageShares,
  splitFightExperience,
} from "../../../src/modules/combat/domain/split-fight-experience.ts";
import { rollBotLoot } from "../../../src/modules/combat/domain/roll-bot-loot.ts";
import { fightLootBlock } from "../../../src/modules/combat/domain/fight-loot-block.ts";
import { playableHuntBot } from "../../support/playable-bot.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

describe("overlevel rewards", () => {
  it("keeps L1 vs L1 at 100% and blocks world loot at +2", () => {
    expect(overlevel(1, 1)).toBe(0);
    expect(overlevelRewardBp(0)).toBe(10_000);
    expect(scaleIntReward(15, 0)).toBe(15);
    expect(scaleMoneyReward(0.2, 0)).toBe(0.2);
    expect(worldLootAllowed(0)).toBe(true);
    expect(worldLootAllowed(2)).toBe(false);
    expect(scaleIntReward(100, 2)).toBe(80);
  });
});

describe("fight money", () => {
  it("rolls gold then rounds to minor units as a gold string", () => {
    expect(rollMoneyGold(0.2, 0.44, { unit: () => 0 })).toBe(0.2);
    expect(goldToMinor(0.2)).toBe(20);
    expect(goldWireString(20)).toBe("0.2");
    expect(goldWireString(0)).toBe("0");
  });

  it("rolls the closed interval even when overlay bounds are inverted", () => {
    expect(rollMoneyGold(9, 0, { unit: () => 0 })).toBe(0);
    expect(rollMoneyGold(9, 0, { unit: () => 1 })).toBe(9);
  });
});

describe("split fight experience", () => {
  it("gives remainder to the top damager and the smaller id on a tie", () => {
    const split = splitFightExperience(15, 1, [
      { characterId: 2, damage: 10, level: 1 },
      { characterId: 1, damage: 10, level: 1 },
    ]);
    expect(
      rankDamageShares([
        { characterId: 2, damage: 10, level: 1 },
        { characterId: 1, damage: 10, level: 1 },
      ])[0]?.characterId,
    ).toBe(1);
    expect(split.get(1)).toBe(8);
    expect(split.get(2)).toBe(7);
  });
});

describe("bot loot roll", () => {
  it("treats unit 0 as NOTHING including the bonus pick", () => {
    const rolled = rollBotLoot(playableHuntBot().reward, new SequenceRandom([0, 0, 0]));
    expect(rolled).toEqual([]);
  });
});

describe("fight loot block", () => {
  it("uses [] for empty loot, not {}", () => {
    expect(
      fightLootBlock({ fightId: "12", experience: 0, money: "0", items: [], artikulList: [] }),
    ).toEqual({
      status: 100,
      fight_id: 12,
      experience: 0,
      money: "0",
      honor: 0,
      revenge: 0,
      loot: [],
      artikul_list: [],
    });
  });
});
