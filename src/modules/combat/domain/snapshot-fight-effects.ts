import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { FightEffectSnap } from "./hunt-human-fight-effects.ts";
import type { HuntHuman } from "./hunt-human.ts";

export function snapshotFightEffects(
  humans: readonly HuntHuman[],
  bots: readonly Readonly<{ id: number }>[],
  persId: number,
): readonly FightEffectSnap[] {
  requireWireIdentity(persId, "pers id");
  const human = humans.find((entry) => entry.heroId === persId);
  if (human) return human.effects.snapshot();
  if (bots.some((bot) => bot.id === persId)) return [];
  throw new Error(`Fight participant ${persId} is missing`);
}
