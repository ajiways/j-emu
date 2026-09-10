import { describe, expect, it } from "vitest";
import { BattlegroundMatches } from "../../../src/modules/battleground/application/battleground-matches.ts";
import type { BattlegroundDefinition } from "../../../src/modules/battleground/domain/battleground-definition.ts";
import {
  KIND_COHORT,
  KIND_LEAGUE,
} from "../../../src/modules/battleground/domain/battleground-definition.ts";

describe("BattlegroundMatches", () => {
  it("scores a kill to 20 and finishes with a league winner", () => {
    const matches = new BattlegroundMatches();
    const live = matches.start(startInput());
    expect(live.copyId).toBe(4);
    expect(matches.byHeroId(1)?.copyId).toBe(4);
    const afterKill = matches.noteKill(4, 1);
    expect(afterKill.scoreLeague).toBe(20);
    expect(afterKill.scoreCohort).toBe(0);
    expect(afterKill.players.get(1)?.killCnt).toBe(1);
    expect(afterKill.players.get(2)?.deathCnt).toBe(1);
    const finished = matches.finish(4, 200);
    expect(finished.finished).toBe(true);
    expect(finished.winnerKind).toBe(KIND_LEAGUE);
    expect(finished.timeFinish).toBe(200);
    matches.unbind(4);
    expect(matches.byCopyId(4)).toBeNull();
    expect(matches.byHeroId(1)).toBeNull();
  });

  it("draws when scores stay equal", () => {
    const matches = new BattlegroundMatches();
    matches.start(startInput());
    const finished = matches.finish(4, 150);
    expect(finished.winnerKind).toBeNull();
  });

  it("rejects a second live copy or a flipped side order", () => {
    const matches = new BattlegroundMatches();
    matches.start(startInput());
    expect(() => matches.start(startInput())).toThrow(/already live/);
    const other = new BattlegroundMatches();
    expect(() =>
      other.start({
        ...startInput(),
        league: player(1, KIND_COHORT),
        cohort: player(2, KIND_LEAGUE),
      }),
    ).toThrow(/league then cohort/);
  });
});

function startInput() {
  return {
    copyId: 4,
    definition: raskop(),
    timeStart: 100,
    league: player(1, KIND_LEAGUE),
    cohort: player(2, KIND_COHORT),
  };
}

function player(heroId: number, kind: number) {
  return {
    heroId,
    accountId: heroId * 10,
    nick: `n${heroId}`,
    level: 6,
    kind,
    returnAreaId: "500",
    dmg: 0,
    exp: 0,
    honor: 0,
    honorBonus: 0,
    killCnt: 0,
    deathCnt: 0,
    fatalityCnt: 0,
    rank: "0",
  };
}

function raskop(): BattlegroundDefinition {
  return {
    id: 2,
    type: "general",
    title: "Раскоп",
    flags: 2,
    available: 1,
    queueLevel: "[6 - 7]",
    error: "",
    playable: true,
    instArtikulId: "10",
    levelMin: 6,
    levelMax: 7,
    returnAreaId: "500",
    westAreaId: "635",
    arenaAreaId: "636",
    eastAreaId: "637",
    inviteTtlSec: 120,
    banSec: 3600,
    matchDurationSec: 600,
    maxScore: 20,
    pointsPerKill: 20,
    fightBg: "5_1",
    fightFlags: "128",
    mapPicture: "m.png",
    statsPicture: "s.jpg",
    description: "d",
    rules: "r",
    roomPos: [
      { areaId: "635", x: 1, y: 1, title: "W" },
      { areaId: "636", x: 2, y: 2, title: "A" },
      { areaId: "637", x: 3, y: 3, title: "E" },
    ],
    leaderGroups: [{ id: "1", minLevel: "8", maxLevel: "9" }],
  };
}
