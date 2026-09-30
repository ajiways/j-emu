import type { FighterEffects } from "./fighter-effects.ts";
import type { MagStats } from "./mag-stats.ts";

/** What a hit needs to know about the one it lands on: its magic resist and what stands on it. */
export type DamageTarget = Readonly<{
  mag: MagStats;
  effects: Pick<FighterEffects, "takenDamage">;
}>;
