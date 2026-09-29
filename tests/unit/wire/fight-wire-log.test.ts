import { describe, expect, it } from "vitest";
import { summarizeFightFrames } from "../../../src/modules/jugger-wire/application/fight-wire-log.ts";

describe("summarizeFightFrames", () => {
  it("keeps the identifying fields of every event and the ack frames", () => {
    expect(
      summarizeFightFrames([
        { rs: true, sq: 4 },
        {
          ev: {
            "1": {
              et: "effUse",
              id: 1,
              persId: 7,
              artikulId: 396,
              kind: 4,
              remainTime: 81,
              img: "hissa_magic1.png",
              title: "не попадает в лог",
            },
            "2": { et: "hpChange", hp: -1, persId: 1_000_000, targetId: 7, react: 2, maxHp: 27 },
          },
        },
      ]),
    ).toEqual([
      { rs: true, sq: 4 },
      { et: "effUse", id: 1, persId: 7, artikulId: 396, kind: 4, remainTime: 81 },
      { et: "hpChange", hp: -1, persId: 1_000_000, targetId: 7, react: 2 },
    ]);
  });
});
