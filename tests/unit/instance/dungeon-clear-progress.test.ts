import { describe, expect, it } from "vitest";
import {
  clearCoinTotal,
  clearProgress,
  dungeonLootExcludeIds,
  progressFinish,
} from "../../../src/modules/instance/domain/dungeon-clear-progress.ts";
import type { DungeonDefinition } from "../../../src/modules/catalog/domain/dungeon-definition.ts";
import { instanceConf } from "../../../src/modules/instance/domain/instance-wire.ts";

const pit = dungeon({
  artikulId: "2",
  hasClear: true,
  progressFinishValue: 7,
  clear: { coinArtikulId: 5986, coinMin: 1, coinMax: 26 },
  loot: { bossBotId: 106, personalGuaranteed: [] },
  spawnKeys: ["544_1", "544_2", "544_3", "544_4", "544_5", "544_6", "boss"],
});

const ogre = dungeon({
  artikulId: "1",
  hasClear: false,
  progressFinishValue: null,
  clear: null,
  loot: { bossBotId: 99, personalGuaranteed: [2371] },
  spawnKeys: ["ogre"],
});

describe("dungeon clear progress", () => {
  it("caps the bar at finish and counts only clearable killed keys", () => {
    expect(clearProgress(pit, new Set())).toBe(0);
    expect(clearProgress(pit, new Set(["544_1"]))).toBe(1);
    expect(
      clearProgress(pit, new Set(["544_1", "544_2", "544_3", "544_4", "544_5", "544_6", "boss"])),
    ).toBe(7);
    expect(clearProgress(pit, new Set(["544_1", "missing"]))).toBe(1);
    expect(clearProgress(ogre, new Set(["ogre"]))).toBe(0);
  });

  it("computes pit coins as the total at current progress, not a delta", () => {
    const coins = pit.clear;
    if (!coins) throw new Error("pit coins are required");
    expect(clearCoinTotal(0, coins, 7)).toBe(0);
    expect(clearCoinTotal(1, coins, 7)).toBe(4);
    expect(clearCoinTotal(2, coins, 7)).toBe(7);
    expect(clearCoinTotal(7, coins, 7)).toBe(26);
    expect(dungeonLootExcludeIds(pit)).toEqual(new Set([5986]));
    expect(dungeonLootExcludeIds(ogre)).toEqual(new Set([2371]));
  });

  it("fail-fasts hasClear without a finish value", () => {
    expect(() => progressFinish({ ...pit, progressFinishValue: null })).toThrow(
      /progress_finish_value is required/,
    );
    expect(() => instanceConf("2", true)).toThrow(/progress_finish_value is required/);
  });
});

function dungeon(input: {
  artikulId: string;
  hasClear: boolean;
  progressFinishValue: number | null;
  clear: DungeonDefinition["clear"];
  loot: DungeonDefinition["loot"];
  spawnKeys: readonly string[];
}): DungeonDefinition {
  return {
    artikulId: input.artikulId,
    title: input.artikulId,
    startAreaId: "544",
    parentAreaId: "510",
    levelMin: 11,
    durationSec: 43200,
    imgUrl: "alt.jpg",
    hasClear: input.hasClear,
    progressFinishValue: input.progressFinishValue,
    clear: input.clear,
    loot: input.loot,
    areas: [
      {
        areaId: "544",
        spawns: input.spawnKeys.map((spawnKey) => ({
          spawnKey,
          huntBotId: spawnKey === "boss" || spawnKey === "ogre" ? 106 : 108,
          encounter: [{ botId: 108, count: 1 }],
          isBoss: spawnKey === "boss" || spawnKey === "ogre",
          countsForClear: true,
          huntMask: "bot_1",
          positionX: 1,
          positionY: 1,
          waitMin: 2,
          waitMax: 6,
          zone: [],
          route: [],
        })),
      },
    ],
  };
}
