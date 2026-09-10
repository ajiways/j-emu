import { describe, expect, it } from "vitest";
import { Area } from "../../../src/modules/world/domain/area.ts";
import type { WorldService } from "../../../src/modules/world/domain/world-service.ts";
import { parkedHuntSpawn } from "../../support/parked-hunt-spawn.ts";
import { worldServiceFor } from "../../support/world-service-for.ts";

const spawn = parkedHuntSpawn(50310, 2, 883, 1499, "bot_1", 10);
const plaza = new Area(
  "503",
  "Горное поселение",
  "forestvillage.swf",
  "2_1",
  "radvei_map.swf",
  0,
  "",
  "",
  "4",
  "Ambience_village.mp3",
  "Ambience_village.mp3",
  0,
  0,
  0,
  0,
  1,
  0,
  [spawn],
);
const emptyPlaza = new Area(
  "503",
  "Горное поселение",
  "forestvillage.swf",
  "2_1",
  "radvei_map.swf",
  0,
  "",
  "",
  "4",
  "Ambience_village.mp3",
  "Ambience_village.mp3",
  0,
  0,
  0,
  0,
  1,
  0,
  [],
);

describe("hunt spawn overlay", () => {
  it("acquires, snapshots fight_id, and releases to idle 0", async () => {
    const world = service(plaza);
    expect(await world.huntSnapshot("503")).toEqual([
      {
        id: 50310,
        artikulId: 2,
        fightId: 0,
        huntMask: "bot_1",
        positionX: 883,
        positionY: 1499,
        prevX: 883,
        prevY: 1499,
      },
    ]);
    expect(
      await world.tryAcquireSpawn({
        areaId: "503",
        spawnId: 50310,
        fightId: "41",
        ownerAccountId: 1,
      }),
    ).toEqual({ ok: true });
    expect((await world.huntSnapshot("503"))[0]?.fightId).toBe(41);
    await world.releaseSpawn({ areaId: "503", spawnId: 50310 });
    expect((await world.huntSnapshot("503"))[0]?.fightId).toBe(0);
  });

  it("denies a second owner and lets the same owner update fightId", async () => {
    const world = service(plaza);
    expect(
      await world.tryAcquireSpawn({
        areaId: "503",
        spawnId: 50310,
        fightId: "7",
        ownerAccountId: 1,
      }),
    ).toEqual({ ok: true });
    expect(
      await world.tryAcquireSpawn({
        areaId: "503",
        spawnId: 50310,
        fightId: "8",
        ownerAccountId: 2,
      }),
    ).toEqual({ ok: false, reason: "busy", fightId: "7" });
    expect((await world.huntSnapshot("503"))[0]?.fightId).toBe(7);
    expect(world.occupiedFightId("503", 50310)).toBe("7");
    expect(
      await world.tryAcquireSpawn({
        areaId: "503",
        spawnId: 50310,
        fightId: "9",
        ownerAccountId: 1,
      }),
    ).toEqual({ ok: true });
    expect((await world.huntSnapshot("503"))[0]?.fightId).toBe(9);
    expect(world.releaseSpawnForFight("7")).toBeNull();
    expect(world.releaseSpawnForFight("9")).toEqual({ areaId: "503", spawnId: 50310 });
    expect((await world.huntSnapshot("503"))[0]?.fightId).toBe(0);
  });

  it("fails fast when the authored spawn is missing", async () => {
    const world = service(emptyPlaza);
    await expect(world.spawn("503", 50310)).resolves.toBeNull();
    await expect(
      world.tryAcquireSpawn({
        areaId: "503",
        spawnId: 50310,
        fightId: "1",
        ownerAccountId: 1,
      }),
    ).rejects.toThrow(/Hunt spawn 50310 is not present in area 503/);
  });
});

function service(area: Area): WorldService {
  return worldServiceFor(area);
}
