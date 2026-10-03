export type BattleRules = Readonly<{
  strPerDamagePoint: number;
  damageSpread: number;
  turnTimeoutSeconds: number;
  meleeBotCounterMs: number;
  turnGrantDelayMs: number;
  maxConsecutiveSkips: number;
  resultRevealDelayMs: number;
  combatSoftC: number;
  combatChanceCap: number;
  critMult: number;
  blockSoftC: number;
  blockChanceCap: number;
  ragChokesDef: number;
  dexChokesRag: number;
  defChokesDex: number;
  magresSoftC: number;
  /** The chance that a swing meeting every condition of an execution becomes one. */
  executionChance: number;
  /**
   * The chance of the `randomly` condition of an emblem card by its `probability` (1, 2, …): the
   * card names only the grade, so the chances are ours. Index 0 is probability 1.
   */
  emblemChances: readonly number[];
}>;
