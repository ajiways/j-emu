export type HeroBotWin = Readonly<{
  botId: number;
  winCnt: number;
}>;

export interface HeroBestiary {
  noteWin(heroId: number, botId: number): Promise<void>;
  listWins(heroId: number): Promise<readonly HeroBotWin[]>;
}
