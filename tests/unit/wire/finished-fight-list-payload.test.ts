import { describe, expect, it } from "vitest";
import { finishedFightListPayload } from "../../../src/modules/jugger-wire/application/finished-fight-list-payload.ts";
import { practiceFinishedFightRecord } from "../../../src/modules/combat/domain/finished-fight-record.ts";

describe("finished fight list payload", () => {
  it("sets viewer me flags and stringifies winner/duration", () => {
    const finishedAt = new Date("2026-09-07T12:00:12.000Z");
    const row = practiceFinishedFightRecord({
      fightId: "9",
      accountId: 1,
      heroId: 10,
      challengerId: 10,
      challengerNick: "Alice",
      challengerLevel: 1,
      challengerKind: 1,
      challengerDead: false,
      challengerFlee: 0,
      acceptorId: 11,
      acceptorNick: "Bob",
      acceptorLevel: 1,
      acceptorKind: 1,
      acceptorDead: true,
      acceptorFlee: 0,
      timeout: 20,
      areaId: "503",
      winner: 1,
      startedAt: new Date("2026-09-07T12:00:00.000Z"),
      finishedAt,
    });
    const payload = finishedFightListPayload(
      { pageIndex: 0, pageCount: 1, totalItems: 1, fights: [row] },
      11,
    );
    expect(payload.status).toBe(100);
    expect(payload.fights[0]).toMatchObject({
      id: 9,
      type: 6,
      winner: "1",
      duration: "12",
    });
    expect(payload.fights[0]?.teams["1"][0]).toMatchObject({ id: 10, me: 0 });
    expect(payload.fights[0]?.teams["2"][0]).toMatchObject({ id: 11, me: 1 });
  });
});
