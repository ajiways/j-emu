import type { MagStats } from "./mag-stats.ts";
import type { StrikeStats } from "./melee-outcome.ts";

/**
 * Identity and combat-visible stats shared by every fight participant,
 * human-controlled or bot-controlled.
 *
 * `hp` is deliberately absent: a human owns live hp on its own object, while a
 * roster bot's hp travels as a deferred presence snapshot that the roster
 * applies after the strike. Reading hp therefore still goes through the owning
 * participant. Every field here is stable for the duration of one strike.
 */
export type Combatant = Readonly<{
  id: number;
  team: 1 | 2;
  maxHp: number;
  mag: MagStats;
  strikeStats: StrikeStats;
}>;
