import type { BattleEvent } from "./battle-event.ts";
import type { BotFighter } from "./bot-fighter.ts";
import type { SchoolOverlay } from "./school-overlay.ts";

export function consumeOverlayCharge(
  bot: BotFighter,
  overlayBefore: SchoolOverlay | null,
): readonly BattleEvent[] {
  if (overlayBefore === null || bot.schoolOverlay === overlayBefore) return [];
  return bot.effects.consumeChargingHit().map((effectId) => ({
    type: "effect-purge" as const,
    effectId,
  }));
}
