import type { FightLootBlock } from "../modules/combat/domain/fight-loot-block.ts";
import type { FightOutcomeSnapshot } from "../modules/combat/domain/fight-outcome-snapshot.ts";
import type {
  FightSettlement,
  HumanLeftSnapshot,
} from "../modules/combat/ports/fight-settlement.ts";
import type { ChatDesk } from "./chat-desk.ts";

export type FightChatFailureSink = Readonly<{
  failed(fightId: string, error: Error): void;
}>;

export class ChatFightSettlement implements FightSettlement {
  constructor(
    private readonly inner: FightSettlement,
    private readonly chat: ChatDesk,
    private readonly failures: FightChatFailureSink,
  ) {}

  persistHumanLeft(snapshot: HumanLeftSnapshot): Promise<void> {
    return this.inner.persistHumanLeft(snapshot);
  }

  async persistFinished(
    outcome: FightOutcomeSnapshot,
  ): Promise<ReadonlyMap<number, FightLootBlock>> {
    const loot = await this.inner.persistFinished(outcome);
    try {
      await this.chat.notifyFightEnded(outcome, loot);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      this.failures.failed(outcome.fightId, failure);
    }
    return loot;
  }
}
