import type { FightLootBlock } from "../modules/combat/domain/fight-loot-block.ts";
import type { FightOutcomeSnapshot } from "../modules/combat/domain/fight-outcome-snapshot.ts";
import type { DeathDurabilityBreak } from "../modules/inventory/domain/apply-death-durability.ts";
import type {
  FightSettlement,
  HumanLeftSnapshot,
} from "../modules/combat/ports/fight-settlement.ts";
import type { ChatDesk } from "./chat-desk.ts";
import type { HuntFightSettlement } from "./hunt-fight-settlement.ts";

export type FightChatFailureSink = Readonly<{
  failed(fightId: string, error: Error): void;
}>;

type PendingEnded = Readonly<{
  outcome: FightOutcomeSnapshot;
  loot: ReadonlyMap<number, FightLootBlock>;
  breaks: ReadonlyMap<number, readonly DeathDurabilityBreak[]>;
}>;

export class ChatFightSettlement implements FightSettlement {
  private readonly pendingEnded = new Map<string, PendingEnded>();

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
    this.pendingEnded.set(outcome.fightId, {
      outcome,
      loot,
      breaks: this.inner.takeDeathBreaks(outcome.fightId),
    });
    return loot;
  }

  async publishEnded(fightId: string): Promise<void> {
    const pending = this.pendingEnded.get(fightId);
    if (!pending) return;
    this.pendingEnded.delete(fightId);
    try {
      await this.chat.notifyFightEnded(pending.outcome, pending.loot, pending.breaks);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      this.failures.failed(fightId, failure);
    }
  }
}
