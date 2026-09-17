import type { BattleEvent } from "./battle-event.ts";
import type { HuntHuman } from "./hunt-human.ts";

export function timeoutHumanTurn(human: HuntHuman, nowMs: number): readonly BattleEvent[] | null {
  if (!human.turnActive) return null;
  human.endTurn();
  const purged = human.effects.onActorEndingTurn(nowMs);
  return [
    { type: "turn-timeout" },
    ...purged.map((effectId) => ({ type: "effect-purge" as const, effectId })),
  ];
}
