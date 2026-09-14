import type { BattleRules } from "../../src/modules/combat/domain/battle-rules.ts";

/** Hunt melee timings from live turns.ts; STR/10 ±15% and CMB-14 knobs are legacy behavior. */
export const UNIT_BATTLE_RULES: BattleRules = {
  strPerDamagePoint: 10,
  damageSpread: 0.15,
  turnTimeoutSeconds: 20,
  meleeBotCounterMs: 1400,
  turnGrantDelayMs: 2500,
  combatSoftC: 600,
  combatChanceCap: 0.4,
  critMult: 2.35,
  blockSoftC: 450,
  blockChanceCap: 0.33,
  ragChokesDef: 0.35,
  dexChokesRag: 0.4,
  defChokesDex: 0.3,
  magresSoftC: 200,
};
