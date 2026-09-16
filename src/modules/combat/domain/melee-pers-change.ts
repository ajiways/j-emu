import type { BattleEvent, HuntBotSnap } from "./battle-event.ts";
import type { HuntHuman } from "./hunt-human.ts";

export function persChangeForHit(
  humans: readonly HuntHuman[],
  bots: readonly HuntBotSnap[],
  sourceId: number,
  targetId: number,
): Extract<BattleEvent, { type: "pers-change" }> {
  return persChangeForParticipants(humans, bots, [sourceId, targetId]);
}

export function persChangeForParticipants(
  humans: readonly HuntHuman[],
  bots: readonly HuntBotSnap[],
  ids: readonly number[],
): Extract<BattleEvent, { type: "pers-change" }> {
  const wanted = new Set(ids);
  const humanSnaps = humans
    .filter((human) => wanted.has(human.heroId))
    .map((human) => human.snapshot());
  const botSnaps = bots.filter((bot) => wanted.has(bot.id));
  if (humanSnaps.length === 0 && botSnaps.length === 0) {
    throw new Error(`Pers-change is missing participants ${ids.join(",")}`);
  }
  return { type: "pers-change", humans: humanSnaps, bots: botSnaps };
}
