import { describe, expect, it } from "vitest";
import { runnedFightListPayload } from "../../../src/modules/jugger-wire/application/runned-fight-list-payload.ts";
import type { RunnedFightRecord } from "../../../src/modules/combat/domain/runned-fight-record.ts";

describe("runned fight list payload", () => {
  it("sets viewer me flags, stringifies duration, and omits winner", () => {
    const row: RunnedFightRecord = {
      id: 9n,
      title: "Нападение Alice на Bob",
      type: 6,
      timeout: 20,
      levelMin: 1,
      levelMax: 1,
      level: 0,
      mlTitle: "1|10|1",
      started: "07.09 12:00",
      duration: 12,
      teams: {
        "1": [{ id: 10, nick: "Alice", level: 1, kind: 1, bot: 0, me: 0 }],
        "2": [{ id: 11, nick: "Bob", level: 1, kind: 1, bot: 0, me: 0 }],
      },
      areaId: "503",
    };
    const payload = runnedFightListPayload(
      { pageIndex: 0, pageCount: 1, totalItems: 1, fights: [row] },
      11,
    );
    expect(payload.status).toBe(100);
    expect(payload.fights[0]).toMatchObject({
      id: 9,
      type: 6,
      duration: "12",
    });
    expect(payload.fights[0]).not.toHaveProperty("winner");
    expect(payload.fights[0]?.teams["1"][0]).toMatchObject({ id: 10, me: 0 });
    expect(payload.fights[0]?.teams["2"][0]).toMatchObject({ id: 11, me: 1 });
  });
});
