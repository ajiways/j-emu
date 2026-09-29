import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { FightEffectSnap } from "./fighter-effects.ts";
import type { HumanFighter } from "./human-fighter.ts";

export function snapshotFightEffects(
  humans: readonly HumanFighter[],
  bots: readonly Readonly<{
    id: number;
    effects: { snapshot(nowMs?: number): readonly FightEffectSnap[] };
  }>[],
  persId: number,
  nowMs: number,
): readonly FightEffectSnap[] {
  requireWireIdentity(persId, "pers id");
  const human = humans.find((entry) => entry.heroId === persId);
  if (human) return human.effects.snapshot(nowMs);
  const bot = bots.find((entry) => entry.id === persId);
  if (bot) return bot.effects.snapshot(nowMs);
  throw new Error(`Fight participant ${persId} is missing`);
}
