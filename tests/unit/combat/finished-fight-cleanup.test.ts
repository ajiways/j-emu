import { describe, expect, it } from "vitest";
import { FinishedFightCleanup } from "../../../src/modules/combat/application/finished-fight-cleanup.ts";
import { huntFinishedFightRecord } from "../../../src/modules/combat/domain/finished-fight-record.ts";
import type { FinishedFightRecord } from "../../../src/modules/combat/domain/finished-fight-record.ts";
import { FINISHED_FIGHT_RETENTION_MS } from "../../../src/modules/combat/domain/finished-fight-retention.ts";
import type { FinishedFightStore } from "../../../src/modules/combat/ports/finished-fight-store.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { RecordingFinishedFightStore } from "../../support/fakes/recording-finished-fight-store.ts";

const now = new Date("2026-09-07T12:00:00.000Z");

describe("FinishedFightCleanup", () => {
  it("keeps rows younger than 72 hours and deletes older ones", async () => {
    const store = new RecordingFinishedFightStore();
    const clock = new MutableClock(now);
    await store.record(row("1", new Date(now.getTime() - FINISHED_FIGHT_RETENTION_MS + 1_000)));
    await store.record(row("2", new Date(now.getTime() - FINISHED_FIGHT_RETENTION_MS - 1_000)));
    const deleted = await new FinishedFightCleanup(store, clock, 100).runBatch();
    expect(deleted).toBe(1);
    expect(store.records.map((item) => item.id.toString())).toEqual(["1"]);
  });

  it("deletes expired rows in bounded batches", async () => {
    const store = new RecordingFinishedFightStore();
    const clock = new MutableClock(now);
    const expired = new Date(now.getTime() - FINISHED_FIGHT_RETENTION_MS - 1_000);
    await store.record(row("1", expired));
    await store.record(row("2", expired));
    await store.record(row("3", expired));
    const cleanup = new FinishedFightCleanup(store, clock, 2);
    expect(await cleanup.runBatch()).toBe(2);
    expect(store.records).toHaveLength(1);
    expect(await cleanup.runBatch()).toBe(1);
    expect(store.records).toHaveLength(0);
    expect(await cleanup.runBatch()).toBe(0);
  });

  it("does not start a second delete while a batch is in flight", async () => {
    const store = new BarrierFinishedFightStore();
    const cleanup = new FinishedFightCleanup(store, new MutableClock(now), 100);
    const first = cleanup.runBatch();
    const second = cleanup.runBatch();
    store.release();
    expect(await Promise.all([first, second])).toEqual([1, 0]);
    expect(store.started).toBe(1);
    expect(store.maxConcurrent).toBe(1);
  });
});

function row(fightId: string, finishedAt: Date) {
  return huntFinishedFightRecord({
    fightId,
    accountId: 1,
    heroId: 1,
    heroNick: "Hero",
    heroLevel: 1,
    heroKind: 1,
    botArtikulId: 2,
    botNick: "Грызль",
    botLevel: 1,
    timeout: 20,
    areaId: "503",
    winner: 1,
    startedAt: finishedAt,
    finishedAt,
  });
}

class BarrierFinishedFightStore implements FinishedFightStore {
  started = 0;
  concurrent = 0;
  maxConcurrent = 0;
  release!: () => void;
  private readonly gate = new Promise<void>((resolve) => {
    this.release = resolve;
  });

  async record(): Promise<void> {
    throw new Error("Barrier store does not record");
  }

  async findById(): Promise<FinishedFightRecord | null> {
    throw new Error("Barrier store does not load");
  }

  async deleteExpiredBatch(): Promise<number> {
    this.started += 1;
    this.concurrent += 1;
    this.maxConcurrent = Math.max(this.maxConcurrent, this.concurrent);
    await this.gate;
    this.concurrent -= 1;
    return 1;
  }
}
