import type { BattleEvent } from "./battle-event.ts";
import type { HuntHuman } from "./hunt-human.ts";

export type HumanTimeout = Readonly<{ events: readonly BattleEvent[]; fell: boolean }>;

/** The turn ran out; `maxSkips` skips in a row kill the AFK fighter. */
export function timeoutHumanTurn(
  human: HuntHuman,
  nowMs: number,
  maxSkips: number,
): HumanTimeout | null {
  if (!human.turnActive) return null;
  human.endTurn();
  const purged = human.effects.onActorEndingTurn(nowMs);
  const fell = human.noteTimeout() >= maxSkips;
  if (fell) human.applyDamage(human.hp);
  return {
    events: [
      { type: "turn-timeout" },
      ...purged.map((effectId) => ({ type: "effect-purge" as const, effectId })),
    ],
    fell,
  };
}
