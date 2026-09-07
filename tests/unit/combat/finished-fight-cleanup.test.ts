import { describe, expect, it } from "vitest";
import { FinishedFightCleanup } from "../../../src/modules/combat/application/finished-fight-cleanup.ts";
import { huntFinishedFightRecord } from "../../../src/modules/combat/domain/finished-fight-record.ts";
import { FINISHED_FIGHT_RETENTION_MS } from "../../../src/modules/combat/domain/finished-fight-retention.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { RecordingFinishedFightStore } from "../../support/fakes/recording-finished-fight-store.ts";

const now = new Date("2026-09-07T12:00:00.000Z");

describe("FinishedFightCleanup", () => {
  it("keeps rows younger than 72 hours and deletes older ones", async () => {
    const store = new RecordingFinishedFightStore();
    const clock = new MutableClock(now);
    await store.record(
      row("100001", new Date(now.getTime() - FINISHED_FIGHT_RETENTION_MS + 1_000)),
    );
    await store.record(
      row("100002", new Date(now.getTime() - FINISHED_FIGHT_RETENTION_MS - 1_000)),
    );
    const deleted = await new FinishedFightCleanup(store, clock, 100).runBatch();
    expect(deleted).toBe(1);
    expect(store.records.map((item) => item.id.toString())).toEqual(["100001"]);
  });

  it("deletes expired rows in bounded batches", async () => {
    const store = new RecordingFinishedFightStore();
    const clock = new MutableClock(now);
    const expired = new Date(now.getTime() - FINISHED_FIGHT_RETENTION_MS - 1_000);
    await store.record(row("100001", expired));
    await store.record(row("100002", expired));
    await store.record(row("100003", expired));
    const cleanup = new FinishedFightCleanup(store, clock, 2);
    expect(await cleanup.runBatch()).toBe(2);
    expect(store.records).toHaveLength(1);
    expect(await cleanup.runBatch()).toBe(1);
    expect(store.records).toHaveLength(0);
    expect(await cleanup.runBatch()).toBe(0);
  });
});

function row(fightId: string, finishedAt: Date) {
  return huntFinishedFightRecord({
    fightId,
    accountId: "account",
    heroId: "hero",
    heroNick: "Hero",
    heroLevel: 1,
    heroKind: 1,
    botId: 2,
    botNick: "Грызль",
    botLevel: 1,
    timeout: 20,
    areaId: "503",
    winner: 1,
    startedAt: finishedAt,
    finishedAt,
  });
}
