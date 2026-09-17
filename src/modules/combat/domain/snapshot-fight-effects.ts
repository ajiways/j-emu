import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { FightEffectSnap } from "./hunt-human-fight-effects.ts";
import type { HuntHuman } from "./hunt-human.ts";

export function snapshotFightEffects(
  humans: readonly HuntHuman[],
  bots: readonly Readonly<{
    id: number;
    effects: { snapshot(): readonly FightEffectSnap[] };
  }>[],
  persId: number,
): readonly FightEffectSnap[] {
  requireWireIdentity(persId, "pers id");
  const human = humans.find((entry) => entry.heroId === persId);
  if (human) return human.effects.snapshot();
  const bot = bots.find((entry) => entry.id === persId);
  if (bot) return bot.effects.snapshot();
  throw new Error(`Fight participant ${persId} is missing`);
}
