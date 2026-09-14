export type BattleRules = Readonly<{
  strPerDamagePoint: number;
  damageSpread: number;
  turnTimeoutSeconds: number;
  meleeBotCounterMs: number;
  turnGrantDelayMs: number;
  combatSoftC: number;
  combatChanceCap: number;
  critMult: number;
  blockSoftC: number;
  blockChanceCap: number;
  ragChokesDef: number;
  dexChokesRag: number;
  defChokesDex: number;
  magresSoftC: number;
}>;
