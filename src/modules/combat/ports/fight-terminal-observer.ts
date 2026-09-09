export type FightFinishedNotice = Readonly<{
  accountId: number;
  fightId: string;
}>;

export interface FightTerminalObserver {
  afterFinished(notice: FightFinishedNotice): Promise<void>;
}
