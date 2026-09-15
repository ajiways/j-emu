import { describe, expect, it } from "vitest";
import { FinishedFightList } from "../../../src/modules/combat/application/finished-fight-list.ts";
import { huntFinishedFightRecord } from "../../../src/modules/combat/domain/finished-fight-record.ts";
import { practiceFinishedFightRecord } from "../../../src/modules/combat/domain/finished-fight-record.ts";
import { FINISHED_FIGHT_RETENTION_MS } from "../../../src/modules/combat/domain/finished-fight-retention.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { RecordingFinishedFightStore } from "../../support/fakes/recording-finished-fight-store.ts";

const now = new Date("2026-09-07T12:00:00.000Z");

describe("finished fight list", () => {
  it("pages area fights, filters type/nick, and hides expired rows without deleting", async () => {
    const store = new RecordingFinishedFightStore();
    const clock = new MutableClock(now);
    const list = new FinishedFightList(store, clock);
    const hunt = huntRow("1", "503", now, "Hero");
    const practice = practiceRow("2", "503", new Date(now.getTime() + 1_000), "Alice", "Bob");
    const otherArea = huntRow("3", "500", now, "Hero");
    const expired = huntRow(
      "4",
      "503",
      new Date(now.getTime() - FINISHED_FIGHT_RETENTION_MS - 1_000),
      "Old",
    );
    await store.record(hunt);
    await store.record(practice);
    await store.record(otherArea);
    await store.record(expired);

    const page = await list.list({ areaId: "503", page: 1 });
    expect(page.totalItems).toBe(2);
    expect(page.pageCount).toBe(1);
    expect(page.pageIndex).toBe(0);
    expect(page.fights.map((row) => row.id)).toEqual([2n, 1n]);
    expect(store.deleted).toEqual([]);

    const typed = await list.list({ areaId: "503", page: 1, type: 6 });
    expect(typed.fights).toHaveLength(1);
    expect(typed.fights[0]?.type).toBe(6);

    const nick = await list.list({ areaId: "503", page: 1, nick: "ali" });
    expect(nick.fights).toHaveLength(1);
    expect(nick.fights[0]?.id).toBe(2n);

    const empty = await list.list({ areaId: "636", page: 1 });
    expect(empty).toMatchObject({ totalItems: 0, pageCount: 0, pageIndex: 0, fights: [] });
  });
});

function huntRow(fightId: string, areaId: string, finishedAt: Date, nick: string) {
  return huntFinishedFightRecord({
    fightId,
    accountId: 1,
    heroId: 1,
    heroNick: nick,
    heroLevel: 1,
    heroKind: 1,
    botArtikulId: 2,
    botNick: "Грызль",
    botLevel: 1,
    timeout: 20,
    areaId,
    winner: 1,
    startedAt: finishedAt,
    finishedAt,
  });
}

function practiceRow(
  fightId: string,
  areaId: string,
  finishedAt: Date,
  challengerNick: string,
  acceptorNick: string,
) {
  return practiceFinishedFightRecord({
    fightId,
    accountId: 1,
    heroId: 10,
    challengerId: 10,
    challengerNick,
    challengerLevel: 1,
    challengerKind: 1,
    challengerDead: false,
    challengerFlee: 0,
    acceptorId: 11,
    acceptorNick,
    acceptorLevel: 1,
    acceptorKind: 1,
    acceptorDead: true,
    acceptorFlee: 0,
    timeout: 20,
    areaId,
    winner: 1,
    startedAt: finishedAt,
    finishedAt,
  });
}
