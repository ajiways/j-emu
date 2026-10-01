import type { FightRules } from "./fight-rules.ts";
import type { HumanFighter } from "./human-fighter.ts";

/** What the aggro button of `human` shows: the charges left, or `null` where the fight has none. */
export function aggroOffer(
  human: HumanFighter,
  rules: Pick<FightRules, "canAggro">,
): number | null {
  return rules.canAggro ? human.casts.aggro : null;
}
