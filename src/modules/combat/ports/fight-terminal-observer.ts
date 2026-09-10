export type FightFinishedNotice = Readonly<{
  accountId: number;
  fightId: string;
  winnerTeam: 1 | 2;
  outcome: "win" | "loss" | "last-leave";
  purpose: "hunt" | "quest" | "friendly-duel";
}>;

export interface FightTerminalObserver {
  afterFinished(notice: FightFinishedNotice): Promise<void>;
}
