export type BattleRules = Readonly<{
  playerDamageMin: number;
  playerDamageMax: number;
  botDamageMin: number;
  botDamageMax: number;
  turnTimeoutSeconds: number;
  meleeBotCounterMs: number;
  turnGrantDelayMs: number;
}>;
