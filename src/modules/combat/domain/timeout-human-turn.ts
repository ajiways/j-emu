import type { BattleEvent } from "./battle-event.ts";
import type { HumanFighter } from "./human-fighter.ts";
import { MELEE_REACT } from "./melee-outcome.ts";
import { resolveHpLoss } from "./resolve-hp-loss.ts";

export type HumanTimeout = Readonly<{ events: readonly BattleEvent[]; fell: boolean }>;

/** The turn ran out; `maxSkips` skips in a row kill the AFK fighter. */
export function timeoutHumanTurn(human: HumanFighter, maxSkips: number): HumanTimeout | null {
  if (!human.turnActive) return null;
  human.endTurn();
  const fell = human.noteTimeout() >= maxSkips;
  const events: BattleEvent[] = [{ type: "turn-timeout" }];
  if (fell) {
    // Self-inflicted lethal damage at the start of his own turn, shown as a standalone hpChange.
    const { applied } = resolveHpLoss(human, human.hp);
    events.push({
      type: "damage",
      sourceId: human.id,
      targetId: human.id,
      animation: "",
      hpChange: -applied,
      targetMaxHp: human.maxHp,
      killed: true,
      react: MELEE_REACT.kill,
      dmgType: 1,
    });
  }
  return { events, fell };
}
