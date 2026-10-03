import { FINISHED_FIGHT_RETENTION_MS } from "../modules/combat/domain/finished-fight-retention.ts";
import type { Clock } from "../shared/kernel/clock.ts";
import { TtlMap } from "../shared/kernel/ttl-map.ts";
import type { FightLootBlock } from "../modules/combat/domain/fight-loot-block.ts";
import type { FightOutcomeSnapshot } from "../modules/combat/domain/fight-outcome-snapshot.ts";
import type { DeathDurabilityBreak } from "../modules/inventory/domain/apply-death-durability.ts";
import type {
  FightSettlement,
  HumanLeftSnapshot,
} from "../modules/combat/ports/fight-settlement.ts";
import type { ChatDesk } from "./chat-desk.ts";
import type { FightOutcomeSettlement } from "./fight-outcome-settlement.ts";
import type { FightProgressUp } from "./fight-progress-log.ts";
import type { ProgressNotifier } from "./progress-notifier.ts";

export type FightChatFailureSink = Readonly<{
  failed(fightId: string, error: Error): void;
}>;

type PendingEnded = Readonly<{
  outcome: FightOutcomeSnapshot;
  loot: ReadonlyMap<number, FightLootBlock>;
  breaks: ReadonlyMap<number, readonly DeathDurabilityBreak[]>;
  progress: readonly FightProgressUp[];
}>;

export class ChatFightSettlement implements FightSettlement {
  private readonly pendingEnded: TtlMap<string, PendingEnded>;

  constructor(
    private readonly inner: FightOutcomeSettlement,
    private readonly chat: ChatDesk,
    private readonly progress: ProgressNotifier,
    clock: Clock,
    private readonly failures: FightChatFailureSink,
  ) {
    this.pendingEnded = new TtlMap(FINISHED_FIGHT_RETENTION_MS, clock);
  }

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
      progress: this.inner.takeProgress(outcome.fightId),
    });
    return loot;
  }

  honorOf(fightId: string): ReadonlyMap<number, number> {
    return this.inner.honorOf(fightId);
  }

  async publishEnded(fightId: string): Promise<void> {
    const pending = this.pendingEnded.get(fightId);
    if (!pending) return;
    this.pendingEnded.delete(fightId);
    try {
      for (const up of pending.progress) {
        if (up.kind === "level") {
          await this.progress.notifyLevel(up.accountId, up.before, up.after);
        } else {
          await this.progress.notifyRank(up.accountId, up.before, up.after, up.heroLevel);
        }
      }
      await this.chat.notifyFightEnded(pending.outcome, pending.loot, pending.breaks);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      this.failures.failed(fightId, failure);
    }
  }
}
