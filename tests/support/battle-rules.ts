import type { BattleRules } from "../../src/modules/combat/domain/battle-rules.ts";

/** Hunt melee timings from live turns.ts; damage dice are legacy behavior. */
export const UNIT_BATTLE_RULES: BattleRules = {
  playerDamageMin: 8,
  playerDamageMax: 12,
  botDamageMin: 2,
  botDamageMax: 4,
  turnTimeoutSeconds: 20,
  meleeBotCounterMs: 1400,
  turnGrantDelayMs: 2500,
};
