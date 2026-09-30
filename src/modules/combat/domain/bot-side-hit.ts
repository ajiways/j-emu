import type { BattleEvent } from "./battle-event.ts";

/** The hit an AOE spell of a bot lands on a fighter other than the one it was aimed at. */
export type BotSideHit = Readonly<{
  targetId: number;
  event: Extract<BattleEvent, { type: "damage" }>;
  killed: boolean;
}>;

/** What a bot's spell did: the events of the aimed foe and the hits on the others it reached. */
export type BotSpellAct = Readonly<{
  events: readonly BattleEvent[];
  sideHits: readonly BotSideHit[];
}>;
