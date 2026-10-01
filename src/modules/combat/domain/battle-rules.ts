export type BattleRules = Readonly<{
  strPerDamagePoint: number;
  damageSpread: number;
  turnTimeoutSeconds: number;
  meleeBotCounterMs: number;
  turnGrantDelayMs: number;
  maxConsecutiveSkips: number;
  resultRevealDelayMs: number;
  /** «Концентрация»: seconds between two uses by a participant waiting for a foe. */
  concentrationCooldownSeconds: number;
  /** «Концентрация»: the most damage one use deals (the least is 1). */
  concentrationMaxDamage: number;
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
