import type { MagStats } from "./mag-stats.ts";
import type { StrikeStats } from "./melee-outcome.ts";

/**
 * Identity and combat-visible stats shared by every fight participant,
 * human-controlled or bot-controlled.
 *
 * `hp` is deliberately absent so that a stale copy cannot compete with the
 * live value: every hp read goes through `targetHp`, which follows the owning
 * participant. `alive` is copied at wrap time and is only meaningful for the
 * list a caller rebuilds after a hit. A human who left live is not `alive`
 * even with remaining hp.
 */
export type Combatant = Readonly<{
  id: number;
  team: 1 | 2;
  maxHp: number;
  mag: MagStats;
  strikeStats: StrikeStats;
  alive: boolean;
}>;
