export type FinishedBattlegroundPlayer = Readonly<{
  heroId: number;
  nick: string;
  level: number;
  kind: number;
  dmg: number;
  exp: number;
  honor: number;
  honorBonus: number;
  killCnt: number;
  deathCnt: number;
  fatalityCnt: number;
  rank: string;
  returnAreaId: string;
}>;

export type FinishedBattlegroundMatch = Readonly<{
  copyId: number;
  bgId: string;
  bgType: string;
  instArtikulId: string;
  title: string;
  timeStart: number;
  timeFinish: number;
  levelMin: number;
  levelMax: number;
  maxScore: number;
  scoreLeague: number;
  scoreCohort: number;
  winnerKind: number | null;
  players: readonly FinishedBattlegroundPlayer[];
}>;

export type FinishedBattlegroundPage = Readonly<{
  matches: readonly FinishedBattlegroundMatch[];
  page: number;
  pages: number;
  search: string;
}>;

export interface BattlegroundHistory {
  record(match: FinishedBattlegroundMatch): Promise<void>;
  list(
    input: Readonly<{ bgId: string; page: number; search: string }>,
  ): Promise<FinishedBattlegroundPage>;
}
