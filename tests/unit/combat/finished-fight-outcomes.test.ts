import { describe, expect, it } from "vitest";
import { FinishedFightConflictError } from "../../../src/modules/combat/domain/finished-fight-conflict-error.ts";
import {
  finishedFightOutcomesEqual,
  huntFinishedFightRecord,
} from "../../../src/modules/combat/domain/finished-fight-record.ts";
import { RecordingFinishedFightStore } from "../../support/fakes/recording-finished-fight-store.ts";

const startedAt = new Date("2026-09-07T12:00:00.000Z");
const finishedAt = new Date("2026-09-07T12:00:46.000Z");

describe("finished fight outcomes", () => {
  it("treats an identical re-record as equal even when timestamps differ", () => {
    const first = huntRow({ finishedAt });
    const replay = huntFinishedFightRecord({
      fightId: "1",
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
      startedAt,
      finishedAt: new Date("2026-09-07T12:01:00.000Z"),
    });
    expect(finishedFightOutcomesEqual(first, replay)).toBe(true);
    expect(first.teams["1"][0]?.id).toBe(1);
  });

  it("accepts an identical duplicate and rejects a conflicting one", async () => {
    const store = new RecordingFinishedFightStore();
    const first = huntRow({ finishedAt });
    await store.record(first);
    await store.record(
      huntFinishedFightRecord({
        fightId: "1",
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
        startedAt,
        finishedAt: new Date("2026-09-07T12:01:00.000Z"),
      }),
    );
    expect(store.records).toHaveLength(1);
    await expect(store.record(huntRow({ finishedAt, winner: 2 }))).rejects.toBeInstanceOf(
      FinishedFightConflictError,
    );
  });
});

function huntRow(input: { finishedAt: Date; winner?: 1 | 2 }) {
  return huntFinishedFightRecord({
    fightId: "1",
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
    winner: input.winner ?? 1,
    startedAt,
    finishedAt: input.finishedAt,
  });
}
