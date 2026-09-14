import { describe, expect, it } from "vitest";
import { BotLootEntry } from "../../../src/modules/catalog/domain/bot-loot-entry.ts";
import { BotReward } from "../../../src/modules/catalog/domain/bot-reward.ts";
import { rollBotLoot } from "../../../src/modules/combat/domain/roll-bot-loot.ts";
import { playableHuntBot, playableHuntMeatLootDraw } from "../../support/playable-bot.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

describe("rollBotLoot", () => {
  it("returns nothing when the Gryzl NOTHING weight swallows every pick", () => {
    expect(rollBotLoot(playableHuntBot().reward, new SequenceRandom([0, 0, 0]))).toEqual([]);
  });

  it("picks Gryzl 77 when the unit draw lands past NOTHING", () => {
    expect(
      rollBotLoot(playableHuntBot().reward, new SequenceRandom(playableHuntMeatLootDraw())),
    ).toEqual([{ artikulId: 77, quantity: 1 }]);
  });

  it("grants a single weighted entry when NOTHING is zero", () => {
    const table = reward({
      lootDropCnt: 1,
      lootNothingWeight: 0,
      lootEntries: [new BotLootEntry(77, 10, 1, 1)],
    });
    expect(rollBotLoot(table, new SequenceRandom([0, 1]))).toEqual([
      { artikulId: 77, quantity: 1 },
    ]);
  });

  it("picks the second of two equal weights past the midpoint", () => {
    const table = reward({
      lootDropCnt: 1,
      lootNothingWeight: 0,
      lootEntries: [new BotLootEntry(77, 10, 1, 1), new BotLootEntry(93, 10, 1, 1)],
    });
    expect(rollBotLoot(table, new SequenceRandom([0, 1]))).toEqual([
      { artikulId: 77, quantity: 1 },
    ]);
    expect(rollBotLoot(table, new SequenceRandom([0.51, 1]))).toEqual([
      { artikulId: 93, quantity: 1 },
    ]);
  });

  it("lets nothing_weight dominate a small item weight", () => {
    const table = reward({
      lootDropCnt: 1,
      lootNothingWeight: 100,
      lootEntries: [new BotLootEntry(77, 10, 1, 1)],
    });
    expect(rollBotLoot(table, new SequenceRandom([0]))).toEqual([]);
    expect(rollBotLoot(table, new SequenceRandom([0.91, 1]))).toEqual([
      { artikulId: 77, quantity: 1 },
    ]);
  });

  it("always grants drop_weight 0 even when lootDropCnt is 0", () => {
    const table = reward({
      lootDropCnt: 0,
      lootNothingWeight: 100,
      lootEntries: [new BotLootEntry(77, 0, 2, 2)],
    });
    expect(rollBotLoot(table, new SequenceRandom([2]))).toEqual([{ artikulId: 77, quantity: 2 }]);
  });

  it("returns nothing for an empty table with leftover dropCnt", () => {
    const table = reward({
      lootDropCnt: 1,
      lootNothingWeight: 1,
      lootEntries: [],
    });
    expect(rollBotLoot(table, new SequenceRandom([0.5]))).toEqual([]);
  });
});

function reward(
  input: Readonly<{
    lootDropCnt: number;
    lootNothingWeight: number;
    lootEntries: readonly BotLootEntry[];
  }>,
): BotReward {
  return new BotReward(
    0,
    0,
    0,
    input.lootDropCnt,
    0,
    0,
    0,
    input.lootNothingWeight,
    input.lootEntries,
  );
}
