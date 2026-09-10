import { describe, expect, it } from "vitest";
import { dungeonHuntId } from "../../../src/modules/instance/domain/dungeon-hunt-id.ts";
import { dungeonSpawnToHunt } from "../../../src/modules/instance/domain/dungeon-spawn-to-hunt.ts";
import { isCopyLive } from "../../../src/modules/instance/domain/instance-copy.ts";
import {
  formatDurationHours,
  instanceConf,
  instanceCreatedChat,
} from "../../../src/modules/instance/domain/instance-wire.ts";

describe("dungeon hunt id", () => {
  it("stays in the dump wire range and is stable for a copy+key", () => {
    const first = dungeonHuntId(1, "ogre");
    expect(first).toBeGreaterThanOrEqual(100_000_000);
    expect(first).toBeLessThan(900_000_000);
    expect(dungeonHuntId(1, "ogre")).toBe(first);
    expect(dungeonHuntId(2, "ogre")).not.toBe(first);
  });
});

describe("instance copy liveness", () => {
  it("is live only before unix expiry", () => {
    const copy = {
      id: 1,
      copyType: "dungeon" as const,
      artikulId: "1",
      createdUnix: 100,
      expiresUnix: 200,
      pendingKick: 0 as const,
    };
    expect(isCopyLive(copy, 199)).toBe(true);
    expect(isCopyLive(copy, 200)).toBe(false);
    expect(isCopyLive({ ...copy, copyType: "bg", artikulId: "10" }, 199)).toBe(true);
  });
});

describe("instance wire", () => {
  it("formats the create chat and ogre conf without progress fields", () => {
    expect(formatDurationHours(3600)).toBe("1 час");
    expect(instanceCreatedChat("Мрачная пещера", 3600)).toBe(
      "Создан инстанс подземелья «Мрачная пещера». Он будет активен 1 час.",
    );
    expect(instanceConf("1", false)).toEqual({ artikul_id: "1", status: 100 });
    expect(() => instanceConf("1", true)).toThrow(/progress bar is outside this slice/);
  });
});

describe("dungeon spawn to hunt", () => {
  it("copies an authored zone onto the hunt spawn", () => {
    const hunt = dungeonSpawnToHunt(
      4,
      {
        spawnKey: "boss",
        huntBotId: 354,
        encounter: [{ botId: 354, count: 1 }],
        isBoss: true,
        countsForClear: true,
        huntMask: "bot_1",
        positionX: 436,
        positionY: 576,
        waitMin: 2,
        waitMax: 8,
        zone: [
          { x: 458, y: 470 },
          { x: 326, y: 463 },
          { x: 351, y: 604 },
        ],
        route: [],
      },
      10,
    );
    expect(hunt.botId).toBe(354);
    expect(hunt.zone).toEqual([
      { x: 458, y: 470 },
      { x: 326, y: 463 },
      { x: 351, y: 604 },
    ]);
    expect(hunt.route).toEqual([]);
  });
});
