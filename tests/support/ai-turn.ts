import type { Battle } from "../../src/modules/combat/domain/battle.ts";
import type { BotTurnResult } from "../../src/modules/combat/domain/battle-actions.ts";

/** The turn of the mob across from player `accountId`, as a test triggers it. */
export function resolveBotMelee(battle: Battle, accountId: number, nowMs: number): BotTurnResult {
  const botId = battle.aiFoeIdOf(accountId);
  if (botId === null) throw new Error("Human duel has no bot to take a turn");
  return battle.resolveAiTurn(botId, nowMs);
}
