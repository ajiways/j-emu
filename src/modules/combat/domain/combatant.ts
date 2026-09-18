import type { MagStats } from "./mag-stats.ts";
import type { StrikeStats } from "./melee-outcome.ts";

/**
 * Identity and combat-visible stats shared by every fight participant,
 * human-controlled or bot-controlled.
 *
 * `hp` and `alive` are copied at wrap time from the live participant. Both
 * humans and roster bots mutate hp in place, so wrapping again after a hit
 * sees the post-hit values. A human who left live is not `alive` even with
 * remaining hp.
 */
export type Combatant = Readonly<{
  id: number;
  team: 1 | 2;
  hp: number;
  maxHp: number;
  mag: MagStats;
  strikeStats: StrikeStats;
  alive: boolean;
}>;
