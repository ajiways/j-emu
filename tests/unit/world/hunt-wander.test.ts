import { describe, expect, it } from "vitest";
import { Area } from "../../../src/modules/world/domain/area.ts";
import { HuntSpawn } from "../../../src/modules/world/domain/hunt-spawn.ts";
import { parkedHuntSpawn } from "../../support/parked-hunt-spawn.ts";
import { ManualCombatDelay } from "../../support/fakes/manual-combat-delay.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { MinHuntRandom, worldServiceFor } from "../../support/world-service-for.ts";

const now = new Date("2026-09-07T12:00:00.000Z");

describe("hunt wander", () => {
  it("parks a home spawn on authored xy", async () => {
    const spawn = parkedHuntSpawn(50310, 2, 883, 1499, "bot_1", 10);
    const [bot] = await snapshotFor(areaOf(spawn));
    expect(bot).toMatchObject({
      id: 50310,
      positionX: 883,
      positionY: 1499,
      prevX: 883,
      prevY: 1499,
      fightId: 0,
    });
  });

  it("walks a route spawn toward the first stop", async () => {
    const spawn = routeSpawn();
    const [bot] = await snapshotFor(areaOf(spawn));
    expect(bot).toMatchObject({
      id: 50309,
      prevX: 922,
      prevY: 1401,
      positionX: 935,
      positionY: 1260,
    });
  });

  it("picks a zone destination instead of staying on home", async () => {
    const spawn = zoneSpawn();
    const [bot] = await snapshotFor(areaOf(spawn));
    expect(bot).toMatchObject({ id: 50101, prevX: 886, prevY: 570 });
    expect(bot?.positionX).not.toBe(886);
    expect(bot?.positionY).not.toBe(570);
  });

  it("freezes interpolated xy while the spawn is locked", async () => {
    const spawn = routeSpawn();
    const delay = new ManualCombatDelay();
    const clock = new MutableClock(now);
    const world = worldServiceFor(areaOf(spawn), { clock, delay, random: new MinHuntRandom() });
    const before = (await world.huntSnapshot("503"))[0];
    if (!before) throw new Error("route spawn is missing from snapshot");
    expect(
      await world.tryAcquireSpawn({
        areaId: "503",
        spawnId: 50309,
        fightId: "41",
        ownerAccountId: 1,
      }),
    ).toEqual({ ok: true });
    clock.advanceMs(60_000);
    await delay.fireDue(clock.now());
    const locked = (await world.huntSnapshot("503"))[0];
    expect(locked).toMatchObject({
      fightId: 41,
      positionX: before.prevX,
      positionY: before.prevY,
      prevX: before.prevX,
      prevY: before.prevY,
    });
  });

  it("hides a spawn for the authored respawn delay", async () => {
    const spawn = routeSpawn();
    const delay = new ManualCombatDelay();
    const clock = new MutableClock(now);
    const world = worldServiceFor(areaOf(spawn), { clock, delay, random: new MinHuntRandom() });
    expect(
      await world.tryAcquireSpawn({
        areaId: "503",
        spawnId: 50309,
        fightId: "41",
        ownerAccountId: 1,
      }),
    ).toEqual({ ok: true });
    await world.releaseSpawn({ areaId: "503", spawnId: 50309 });
    expect(await world.huntSnapshot("503")).toEqual([]);
    clock.advanceMs(2_999);
    await delay.fireDue(clock.now());
    expect(await world.huntSnapshot("503")).toEqual([]);
    clock.advanceMs(1);
    await delay.fireDue(clock.now());
    const [bot] = await world.huntSnapshot("503");
    expect(bot?.id).toBe(50309);
    expect(bot?.fightId).toBe(0);
  });

  it("fails fast when a spawn authors both a route and a zone", () => {
    expect(
      () =>
        new HuntSpawn(50309, 4, 922, 1401, "bot_1", {
          huntSpeed: 10,
          waitMin: 0,
          waitMax: 0,
          respawnTimeMin: 3,
          respawnTimeMax: 15,
          zone: [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 3, y: 3 },
          ],
          route: [
            { x: 1, y: 1, waitMin: 2, waitMax: 8 },
            { x: 2, y: 2, waitMin: 2, waitMax: 8 },
          ],
        }),
    ).toThrow(/cannot author both a route and a zone/);
  });
});

function areaOf(spawn: HuntSpawn): Area {
  return new Area(
    spawn.id === 50101 ? "501" : "503",
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
}

async function snapshotFor(area: Area) {
  return worldServiceFor(area, {
    clock: new MutableClock(now),
    delay: new ManualCombatDelay(),
    random: new MinHuntRandom(),
  }).huntSnapshot(area.id);
}

function routeSpawn(): HuntSpawn {
  return new HuntSpawn(50309, 4, 922, 1401, "bot_1", {
    huntSpeed: 10,
    waitMin: 0,
    waitMax: 0,
    respawnTimeMin: 3,
    respawnTimeMax: 15,
    zone: [],
    route: [
      { x: 935, y: 1260, waitMin: 2, waitMax: 8 },
      { x: 773, y: 1275, waitMin: 2, waitMax: 8 },
    ],
  });
}

function zoneSpawn(): HuntSpawn {
  return new HuntSpawn(50101, 4, 886, 570, "bot_1", {
    huntSpeed: 10,
    waitMin: 2,
    waitMax: 6,
    respawnTimeMin: 0,
    respawnTimeMax: 0,
    zone: [
      { x: 887, y: 498 },
      { x: 743, y: 590 },
      { x: 788, y: 699 },
      { x: 1007, y: 767 },
      { x: 1152, y: 597 },
    ],
    route: [],
  });
}
