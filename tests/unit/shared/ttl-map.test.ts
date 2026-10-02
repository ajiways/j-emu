import { describe, expect, it } from "vitest";
import { TtlMap } from "../../../src/shared/kernel/ttl-map.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";

describe("TtlMap", () => {
  const start = new Date("2026-10-03T12:00:00.000Z");

  it("holds an entry until its time is up", () => {
    const clock = new MutableClock(start);
    const map = new TtlMap<string, number>(1000, clock);
    map.set("a", 1);
    clock.advanceMs(999);
    expect(map.get("a")).toBe(1);
    clock.advanceMs(1);
    expect(map.get("a")).toBeUndefined();
    expect(map.has("a")).toBe(false);
  });

  it("drops the outdated entries on a write, so nothing piles up", () => {
    const clock = new MutableClock(start);
    const map = new TtlMap<number, number>(1000, clock);
    for (let key = 0; key < 100; key += 1) map.set(key, key);
    clock.advanceMs(1001);
    map.set(1000, 1);
    expect(map.size).toBe(1);
  });

  it("renews the time of a rewritten key and keeps the order of expiry", () => {
    const clock = new MutableClock(start);
    const map = new TtlMap<string, number>(1000, clock);
    map.set("a", 1);
    clock.advanceMs(600);
    map.set("b", 2);
    map.set("a", 3);
    clock.advanceMs(500);
    map.set("c", 4);
    expect(map.get("b")).toBe(2);
    expect(map.get("a")).toBe(3);
  });

  it("refuses a time that is not a positive integer", () => {
    expect(() => new TtlMap(0, new MutableClock(start))).toThrow(/ttl/);
  });
});
