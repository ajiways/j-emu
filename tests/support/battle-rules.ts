import type { BattleRules } from "../../src/modules/combat/domain/battle-rules.ts";

/** Hunt melee timings from live turns.ts; STR/10 ±15% is legacy behavior. */
export const UNIT_BATTLE_RULES: BattleRules = {
  strPerDamagePoint: 10,
  damageSpread: 0.15,
  turnTimeoutSeconds: 20,
  meleeBotCounterMs: 1400,
  turnGrantDelayMs: 2500,
};
