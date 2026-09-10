import { describe, expect, it } from "vitest";
import { bestiaryCreditHeroIds } from "../../../src/modules/character/domain/bestiary-kill-credit.ts";
import { bestiaryInfoWire } from "../../../src/modules/character/domain/bestiary-wire.ts";

describe("bestiary credit and wire", () => {
  it("credits only the top damager when they are not in a party", () => {
    expect(
      bestiaryCreditHeroIds({
        kind: "win",
        topCharacterId: 2,
        humanIds: [1, 2],
        partyMemberIds: null,
      }),
    ).toEqual([2]);
  });

  it("credits every fight participant in the top damager party", () => {
    expect(
      bestiaryCreditHeroIds({
        kind: "win",
        topCharacterId: 1,
        humanIds: [1, 2, 3],
        partyMemberIds: new Set([1, 2, 9]),
      }),
    ).toEqual([1, 2]);
  });

  it("skips losses and maps wins to string id/win_cnt", () => {
    expect(
      bestiaryCreditHeroIds({
        kind: "loss",
        topCharacterId: 1,
        humanIds: [1],
        partyMemberIds: null,
      }),
    ).toEqual([]);
    expect(bestiaryInfoWire([{ botId: 2, winCnt: 3 }])).toEqual({
      status: 100,
      bots: { "2": { id: "2", win_cnt: "3" } },
    });
    expect(bestiaryInfoWire([])).toEqual({ status: 100, bots: {} });
    expect(() => bestiaryInfoWire([{ botId: 2, winCnt: 0 }])).toThrow(
      "Bestiary win_cnt for bot 2 is missing",
    );
    expect(() =>
      bestiaryCreditHeroIds({
        kind: "win",
        topCharacterId: null,
        humanIds: [1],
        partyMemberIds: null,
      }),
    ).toThrow("Hunt win is missing a top damager for bestiary credit");
  });
});
