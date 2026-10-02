import type { FightHumanOutcome, FightOutcomeSnapshot } from "../domain/fight-outcome-snapshot.ts";
import type { FightLootBlock } from "../domain/fight-loot-block.ts";

export type HumanLeftSnapshot = Readonly<{
  fightId: string;
  accountId: number;
  characterId: number;
  hp: number;
  mp: number;
  pocket: FightHumanOutcome["pocket"];
}>;

export interface FightSettlement {
  persistHumanLeft(snapshot: HumanLeftSnapshot): Promise<void>;
  persistFinished(outcome: FightOutcomeSnapshot): Promise<ReadonlyMap<number, FightLootBlock>>;
  /** The heroism each account earned in the finished fight; accounts that earned none are absent. */
  honorOf(fightId: string): ReadonlyMap<number, number>;
  /** System chat after fproxy `fightFinish` is delivered, not on the killing blow. */
  publishEnded(fightId: string): Promise<void>;
}
