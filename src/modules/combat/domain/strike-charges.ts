import { RAGE_EFFECT_ARTIKUL_ID } from "./rage-bonus.ts";
import { addDrain, NO_DRAIN, type Drain } from "./drain.ts";
import type { SchoolOverlay } from "./school-overlay.ts";
import type { StandingEffect } from "./standing-effect.ts";
import type { SpentStrike } from "./strike-mods.ts";

/** A charge is spent; an effect with none left is removed and its icon goes. */
function spendCharge(standing: StandingEffect[], fx: StandingEffect, purged: number[]): void {
  fx.remainTurns -= 1;
  if (fx.remainTurns > 0) return;
  standing.splice(standing.indexOf(fx), 1);
  purged.push(fx.id);
}

/** One physical swing spends a charge of every charging effect that changes the swing itself. */
export function takeStrikeCharges(standing: StandingEffect[]): SpentStrike {
  const purged: number[] = [];
  const pcStrs: number[] = [];
  let strFlat = 0;
  let critChance = 0;
  let drain: Drain = NO_DRAIN;
  let furySpent = false;
  for (const fx of [...standing]) {
    if (!fx.charging || !fx.strike || fx.strike.overlay !== null) continue;
    if (fx.strike.pcStr !== 0) pcStrs.push(fx.strike.pcStr);
    strFlat += fx.strike.strFlat;
    critChance = Math.max(critChance, fx.strike.critChance);
    drain = addDrain(drain, fx.strike.drain);
    if (fx.artikulId === RAGE_EFFECT_ARTIKUL_ID) furySpent = true;
    spendCharge(standing, fx, purged);
  }
  return { pcStrs, strFlat, critChance, drain, purged, furySpent };
}

/**
 * The school float of the oldest charged overlay, once the swing has landed on a living target;
 * `null` when none stands. A target already down keeps the charge for the next one.
 */
export function takeOverlayCharge(
  standing: StandingEffect[],
): Readonly<{ overlay: SchoolOverlay; purged: readonly number[] }> | null {
  const fx = standing.find((entry) => entry.charging && entry.strike?.overlay);
  const overlay = fx?.strike?.overlay;
  if (!fx || !overlay) return null;
  const purged: number[] = [];
  spendCharge(standing, fx, purged);
  return { overlay, purged };
}
