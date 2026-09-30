import type { BattleEvent } from "./battle-event.ts";
import type { BotSideHit } from "./bot-side-hit.ts";
import type { HumanFighter } from "./human-fighter.ts";

export type BotMeleeResult = Readonly<{
  events: readonly BattleEvent[];
  /** A player fell to the turn: his place is handed on unless the fight is over. */
  killedPlayer: boolean;
  /** Hits of an AOE spell on fighters other than the aimed foe. */
  sideHits: readonly BotSideHit[];
}>;

export function grantTurn(
  human: HumanFighter,
  timeoutSeconds: number,
  nowMs: number,
): BattleEvent | null {
  if (human.waiting || human.hp === 0 || human.turnActive) return null;
  human.beginTurn(nowMs, timeoutSeconds);
  return { type: "turn-granted", timeoutSeconds };
}
