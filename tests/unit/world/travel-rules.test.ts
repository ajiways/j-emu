import { describe, expect, it } from "vitest";
import { Area } from "../../../src/modules/world/domain/area.ts";
import { canExitInterior } from "../../../src/modules/world/domain/interior-exit.ts";
import { MissingLinkError } from "../../../src/modules/world/domain/missing-link-error.ts";
import {
  remainingAreaFtime,
  travelFtime,
  travelLockActive,
  waitLockError,
  waitLockSeconds,
} from "../../../src/modules/world/domain/travel-ftime.ts";
import { WorldService } from "../../../src/modules/world/domain/world-service.ts";
import type { WorldRepository } from "../../../src/modules/world/ports/world-repository.ts";

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
  [],
);

const shop = new Area(
  "504",
  "Деревенская лавка",
  "forestvillage.swf",
  "2_1",
  "radvei_map.swf",
  0,
  "store",
  "503",
  "",
  "",
  "",
  0,
  0,
  0,
  0,
  0,
  0,
  [],
);

describe("travel ftime", () => {
  it("uses SPEED 0 as dest.ftimeMax", () => {
    expect(travelFtime(15, 0)).toBe(15);
    expect(travelFtime(0, 0)).toBe(0);
  });

  it("keeps the SPEED formula", () => {
    expect(travelFtime(30, 3)).toBe(29);
  });
});

describe("travel wait lock", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("reports remaining whole seconds and wait N with nbsp", () => {
    const ready = new Date(now.getTime() + 15_000);
    expect(remainingAreaFtime(ready, now)).toBe(15);
    expect(waitLockSeconds(ready, now)).toBe(15);
    expect(waitLockError(15)).toBe(
      "Подождите! Дальнейшее перемещение станет возможным по истечении 15&nbsp;с..",
    );
  });

  it("treats NULL and expired lock as free", () => {
    expect(remainingAreaFtime(null, now)).toBe(0);
    expect(travelLockActive(null, now)).toBe(false);
    expect(travelLockActive(now, now)).toBe(false);
  });

  it("ceils a fractional remaining lock to at least 1", () => {
    const ready = new Date(now.getTime() + 400);
    expect(remainingAreaFtime(ready, now)).toBe(0);
    expect(travelLockActive(ready, now)).toBe(true);
    expect(waitLockSeconds(ready, now)).toBe(1);
  });
});

describe("interior exit", () => {
  it("allows store with parent and denies outdoor", () => {
    expect(canExitInterior(shop)).toBe(true);
    expect(canExitInterior(plaza)).toBe(false);
  });
});

describe("requireLink", () => {
  it("denies a missing edge", async () => {
    const world = new WorldService({
      findArea: async () => plaza,
      listLinksFrom: async () => [],
      findLink: async () => null,
    } satisfies WorldRepository);
    await expect(world.requireLink("503", "502")).rejects.toBeInstanceOf(MissingLinkError);
    await expect(world.requireLink("503", "502")).rejects.toThrow("некуда идти");
  });
});
