export type BattleRules = Readonly<{
  strPerDamagePoint: number;
  damageSpread: number;
  turnTimeoutSeconds: number;
  meleeBotCounterMs: number;
  turnGrantDelayMs: number;
}>;
