export type PocketCellSnapshot = Readonly<{
  itemId: number;
  artifactId: number;
  position: number;
  startCount: number;
  currentCount: number;
}>;

export type FightHumanOutcome = Readonly<{
  accountId: number;
  characterId: number;
  level: number;
  hp: number;
  damageToBot: number;
  leftLive: boolean;
  pocket: readonly PocketCellSnapshot[];
}>;

export type FightOutcomeKind = "win" | "loss" | "last-leave";

export type FightOutcomeSnapshot = Readonly<{
  fightId: string;
  botId: number;
  botLevel: number;
  winnerTeam: 1 | 2;
  kind: FightOutcomeKind;
  humans: readonly FightHumanOutcome[];
}>;
