import type { BattleEvent, HuntBotSnap } from "./battle-event.ts";
import type { HuntHuman } from "./hunt-human.ts";

export function persChangeForHit(
  humans: readonly HuntHuman[],
  bots: readonly HuntBotSnap[],
  sourceId: number,
  targetId: number,
): Extract<BattleEvent, { type: "pers-change" }> {
  const ids = new Set([sourceId, targetId]);
  const humanSnaps = humans
    .filter((human) => ids.has(human.heroId))
    .map((human) => human.snapshot());
  const botSnaps = bots.filter((bot) => ids.has(bot.id));
  if (humanSnaps.length === 0 && botSnaps.length === 0) {
    throw new Error(`Melee pers-change is missing source ${sourceId} and target ${targetId}`);
  }
  return { type: "pers-change", humans: humanSnaps, bots: botSnaps };
}
