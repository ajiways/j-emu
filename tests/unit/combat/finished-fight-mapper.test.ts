import { describe, expect, it } from "vitest";
import {
  toArenaFinishedFightRow,
  toFinishedFightInfoView,
} from "../../../src/modules/combat/application/finished-fight-wire-mapper.ts";
import { huntFinishedFightRecord } from "../../../src/modules/combat/domain/finished-fight-record.ts";

const startedAt = new Date("2026-09-07T12:00:00.000Z");
const finishedAt = new Date("2026-09-07T12:00:46.000Z");

describe("finished fight wire mapper", () => {
  it("matches the old arena|finished_fights row and info view fields", () => {
    const row = huntFinishedFightRecord({
      fightId: "100000",
      accountId: "account",
      heroId: "hero-id",
      heroNick: "Hero",
      heroLevel: 1,
      heroKind: 1,
      botId: 2,
      botNick: "Грызль",
      botLevel: 1,
      timeout: 20,
      areaId: "503",
      winner: 1,
      startedAt,
      finishedAt,
    });
    expect(toArenaFinishedFightRow(row)).toEqual({
      id: 100000,
      title: "Нападение Hero на Грызль",
      type: 1,
      timeout: 20,
      level_min: 1,
      level_max: 1,
      level: 0,
      ml_title: "1|hero-id|2",
      winner: "1",
      started: row.started,
      duration: "46",
      teams: row.teams,
    });
    const info = toFinishedFightInfoView(row);
    expect(info.status).toBe(100);
    expect(info.winner_team).toBe("1");
    expect(info.fight).toMatchObject({
      id: "100000",
      type: "1",
      type_title: "бой",
      finished: 1,
      duration: "46&nbsp;с.",
      timeout: 20,
      area: "—",
    });
    expect(info.users["1"]).toMatchObject({
      id: "hero-id",
      bot: false,
      team: 1,
      dead: false,
    });
    expect(info.users["2"]).toMatchObject({
      id: "2",
      bot: true,
      artikul_id: 2,
      team: 2,
      dead: true,
    });
  });
});
