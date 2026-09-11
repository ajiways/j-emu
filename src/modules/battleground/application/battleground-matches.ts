import type { BattlegroundDefinition } from "../domain/battleground-definition.ts";
import { KIND_COHORT, KIND_LEAGUE } from "../domain/battleground-definition.ts";

export type MatchPlayer = Readonly<{
  heroId: number;
  accountId: number;
  nick: string;
  level: number;
  kind: number;
  returnAreaId: string;
  dmg: number;
  exp: number;
  honor: number;
  honorBonus: number;
  killCnt: number;
  deathCnt: number;
  fatalityCnt: number;
  rank: string;
}>;

export type LiveBattlegroundMatch = {
  copyId: number;
  definition: BattlegroundDefinition;
  timeStart: number;
  timeFinish: number;
  scoreLeague: number;
  scoreCohort: number;
  players: Map<number, MatchPlayer>;
  finished: boolean;
  winnerKind: number | null;
  pendingFinish: boolean;
};

export class BattlegroundMatches {
  private readonly byCopy = new Map<number, LiveBattlegroundMatch>();
  private readonly byHero = new Map<number, LiveBattlegroundMatch>();

  start(
    input: Readonly<{
      copyId: number;
      definition: BattlegroundDefinition;
      timeStart: number;
      league: MatchPlayer;
      cohort: MatchPlayer;
    }>,
  ): LiveBattlegroundMatch {
    if (this.byCopy.has(input.copyId)) {
      throw new Error(`Battleground copy ${input.copyId} is already live`);
    }
    if (this.byHero.has(input.league.heroId) || this.byHero.has(input.cohort.heroId)) {
      throw new Error("Hero is already in a battleground match");
    }
    if (input.league.kind !== KIND_LEAGUE || input.cohort.kind !== KIND_COHORT) {
      throw new Error("Раскоп sides must be league then cohort");
    }
    const match: LiveBattlegroundMatch = {
      copyId: input.copyId,
      definition: input.definition,
      timeStart: input.timeStart,
      timeFinish: input.timeStart + input.definition.matchDurationSec,
      scoreLeague: 0,
      scoreCohort: 0,
      players: new Map([
        [input.league.heroId, input.league],
        [input.cohort.heroId, input.cohort],
      ]),
      finished: false,
      winnerKind: null,
      pendingFinish: false,
    };
    this.byCopy.set(input.copyId, match);
    this.byHero.set(input.league.heroId, match);
    this.byHero.set(input.cohort.heroId, match);
    return match;
  }

  byHeroId(heroId: number): LiveBattlegroundMatch | null {
    return this.byHero.get(heroId) ?? null;
  }

  byCopyId(copyId: number): LiveBattlegroundMatch | null {
    return this.byCopy.get(copyId) ?? null;
  }

  noteKill(copyId: number, winnerHeroId: number): LiveBattlegroundMatch {
    const match = this.requireLive(copyId);
    const winner = match.players.get(winnerHeroId);
    if (!winner) throw new Error(`Battleground hero ${winnerHeroId} is not in copy ${copyId}`);
    const next: MatchPlayer = { ...winner, killCnt: winner.killCnt + 1 };
    match.players.set(winnerHeroId, next);
    if (winner.kind === KIND_COHORT) match.scoreCohort += match.definition.pointsPerKill;
    else match.scoreLeague += match.definition.pointsPerKill;
    for (const player of match.players.values()) {
      if (player.heroId === winnerHeroId) continue;
      match.players.set(player.heroId, { ...player, deathCnt: player.deathCnt + 1 });
    }
    return match;
  }

  noteFightHonor(
    copyId: number,
    heroId: number,
    share: Readonly<{ honor: number; dmg: number; rank: string }>,
  ): void {
    const match = this.requireLive(copyId);
    const player = match.players.get(heroId);
    if (!player) throw new Error(`Battleground hero ${heroId} is not in copy ${copyId}`);
    if (!Number.isInteger(share.honor) || share.honor < 0) {
      throw new Error("Battleground fight honor must be a non-negative integer");
    }
    if (!Number.isInteger(share.dmg) || share.dmg < 0) {
      throw new Error("Battleground fight damage must be a non-negative integer");
    }
    if (!share.rank) throw new Error("Battleground fight rank is required");
    match.players.set(heroId, {
      ...player,
      honor: player.honor + share.honor,
      dmg: player.dmg + share.dmg,
      rank: share.rank,
    });
  }

  finish(copyId: number, nowUnix: number): LiveBattlegroundMatch {
    const match = this.requireLive(copyId);
    match.finished = true;
    match.timeFinish = nowUnix;
    if (match.scoreLeague > match.scoreCohort) match.winnerKind = KIND_LEAGUE;
    else if (match.scoreCohort > match.scoreLeague) match.winnerKind = KIND_COHORT;
    else match.winnerKind = null;
    return match;
  }

  unbind(copyId: number): void {
    const match = this.byCopy.get(copyId);
    if (!match) throw new Error(`Battleground copy ${copyId} is missing`);
    this.byCopy.delete(copyId);
    for (const heroId of match.players.keys()) this.byHero.delete(heroId);
  }

  private requireLive(copyId: number): LiveBattlegroundMatch {
    const match = this.byCopy.get(copyId);
    if (!match) throw new Error(`Battleground copy ${copyId} is missing`);
    if (match.finished) throw new Error(`Battleground copy ${copyId} is already finished`);
    return match;
  }
}
