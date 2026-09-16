import type { FightLootBlock } from "../modules/combat/domain/fight-loot-block.ts";
import type { FightOutcomeSnapshot } from "../modules/combat/domain/fight-outcome-snapshot.ts";
import type {
  FightSettlement,
  HumanLeftSnapshot,
} from "../modules/combat/ports/fight-settlement.ts";
import type { ChatDesk } from "./chat-desk.ts";
import type { HuntFightSettlement } from "./hunt-fight-settlement.ts";

export type FightChatFailureSink = Readonly<{
  failed(fightId: string, error: Error): void;
}>;

export class ChatFightSettlement implements FightSettlement {
  constructor(
    private readonly inner: HuntFightSettlement,
    private readonly chat: ChatDesk,
    private readonly failures: FightChatFailureSink,
  ) {}

  async persistHumanLeft(snapshot: HumanLeftSnapshot): Promise<void> {
    await this.inner.persistHumanLeft(snapshot);
    try {
      await this.chat.notifyDeathBreaks(
        snapshot.accountId,
        this.inner.takeAccountDeathBreaks(snapshot.fightId, snapshot.accountId),
      );
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      this.failures.failed(snapshot.fightId, failure);
    }
  }

  async persistFinished(
    outcome: FightOutcomeSnapshot,
  ): Promise<ReadonlyMap<number, FightLootBlock>> {
    const loot = await this.inner.persistFinished(outcome);
    try {
      await this.chat.notifyFightEnded(outcome, loot, this.inner.takeDeathBreaks(outcome.fightId));
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      this.failures.failed(outcome.fightId, failure);
    }
    return loot;
  }
}
