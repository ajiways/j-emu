import { describe, expect, it } from "vitest";
import { paginateRunnedFights } from "../../../src/modules/combat/application/runned-fight-list.ts";
import type { RunnedFightRecord } from "../../../src/modules/combat/domain/runned-fight-record.ts";

describe("runned fight list", () => {
  it("pages live rows, filters type/nick, and uses empty page_count 0", () => {
    const hunt = row(1n, 1, "Hero", "Грызль");
    const practice = row(2n, 6, "Alice", "Bob");
    const page = paginateRunnedFights([practice, hunt], { areaId: "503", page: 1 });
    expect(page).toMatchObject({ totalItems: 2, pageCount: 1, pageIndex: 0 });
    expect(page.fights.map((item) => item.id)).toEqual([2n, 1n]);

    const typed = paginateRunnedFights([practice, hunt], { areaId: "503", page: 1, type: 6 });
    expect(typed.fights).toHaveLength(1);
    expect(typed.fights[0]?.type).toBe(6);

    const nick = paginateRunnedFights([practice, hunt], { areaId: "503", page: 1, nick: "ali" });
    expect(nick.fights).toHaveLength(1);
    expect(nick.fights[0]?.id).toBe(2n);

    const empty = paginateRunnedFights([], { areaId: "503", page: 1 });
    expect(empty).toMatchObject({ totalItems: 0, pageCount: 0, pageIndex: 0, fights: [] });
  });
});

function row(id: bigint, type: number, nick1: string, nick2: string): RunnedFightRecord {
  return {
    id,
    title: `Нападение ${nick1} на ${nick2}`,
    type,
    timeout: 20,
    levelMin: 1,
    levelMax: 1,
    level: 0,
    mlTitle: `1|1|1`,
    started: "07.09 12:00",
    duration: 3,
    teams: {
      "1": [{ id: 10, nick: nick1, level: 1, kind: 1, bot: 0, me: 0 }],
      "2":
        type === 6
          ? [{ id: 11, nick: nick2, level: 1, kind: 1, bot: 0, me: 0 }]
          : [
              {
                bot: 1,
                artikul_id: "2",
                id: "1000001",
                nick: nick2,
                level: "1",
                kind: "0",
                me: 0,
              },
            ],
    },
    areaId: "503",
  };
}
