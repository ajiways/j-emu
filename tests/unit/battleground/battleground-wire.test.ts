import { describe, expect, it } from "vitest";
import type { BattlegroundDefinition } from "../../../src/modules/battleground/domain/battleground-definition.ts";
import {
  KIND_COHORT,
  KIND_LEAGUE,
} from "../../../src/modules/battleground/domain/battleground-definition.ts";
import {
  finishedHistoryWire,
  inviteWindow,
  listRow,
} from "../../../src/modules/battleground/domain/battleground-wire.ts";

const overlay = {
  requestCount: 2,
  userInQueue: 1 as const,
  bgCount: 1,
  penaltyTime: 12,
  hasAnyRequest: 1 as const,
};

describe("battleground wire", () => {
  it("overlays live queue only on the playable card", () => {
    const playable = raskop({ playable: true, available: 1 });
    const dump = raskop({
      id: 1,
      title: "Шахты",
      playable: false,
      available: 0,
      error: "скоро",
    });
    expect(listRow(playable, overlay)).toMatchObject({
      id: 2,
      request_count: 2,
      user_in_queue: 1,
      bg_count: 1,
      penalty_time: 12,
      has_any_request: 1,
    });
    expect(listRow(dump, overlay)).toMatchObject({
      id: 1,
      request_count: 0,
      user_in_queue: 0,
      bg_count: 0,
      penalty_time: 12,
      has_any_request: 1,
      error: "скоро",
    });
  });

  it("builds the 120s invite window and typed history teams", () => {
    const card = raskop({ playable: true });
    const window = inviteWindow(card, 99);
    expect(window).toMatchObject({
      title: "Приглашение на поле битвы",
      show_ttl: "120",
      hide_time: 99,
      disable_user_actions: 1,
    });
    expect(window.buttons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          caption: "Согласиться",
          action: {
            object: "arena",
            action: "bg_request",
            form: { id: "2", status: "confirm" },
          },
        }),
      ]),
    );
    expect(
      finishedHistoryWire({
        copyId: 9,
        bgId: "2",
        bgType: "general",
        instArtikulId: "10",
        title: "Раскоп",
        timeStart: 1,
        timeFinish: 2,
        levelMin: 6,
        levelMax: 7,
        maxScore: 20,
        scoreLeague: 20,
        scoreCohort: 0,
        winnerKind: KIND_LEAGUE,
        players: [historyPlayer(1, KIND_LEAGUE, 1, 0), historyPlayer(2, KIND_COHORT, 0, 1)],
      }),
    ).toMatchObject({
      bg_id: "2",
      instance_id: "9",
      teams: {
        "2": { score: 20, users: [expect.objectContaining({ user_id: 1, kill_cnt: 1 })] },
        "3": { score: 0, users: [expect.objectContaining({ user_id: 2, death_cnt: 1 })] },
      },
    });
  });
});

function historyPlayer(heroId: number, kind: number, killCnt: number, deathCnt: number) {
  return {
    heroId,
    nick: `n${heroId}`,
    level: 6,
    kind,
    returnAreaId: "500",
    dmg: 0,
    exp: 0,
    honor: 0,
    honorBonus: 0,
    killCnt,
    deathCnt,
    fatalityCnt: 0,
    rank: "0",
  };
}

function raskop(overrides: Partial<BattlegroundDefinition>): BattlegroundDefinition {
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
    roomPos: [],
    leaderGroups: [],
    ...overrides,
  };
}
