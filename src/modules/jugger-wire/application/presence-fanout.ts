import { populationDiff } from "../../world/domain/character-info.ts";
import type { PresenceNotice } from "../../world/domain/presence-notice.ts";
import type { PresenceService } from "../../world/application/presence-service.ts";
import type { EsrvOutbox } from "./esrv-outbox.ts";
import type { LongPollCoordinator } from "./long-poll-coordinator.ts";

export class PresenceFanout {
  constructor(
    private readonly presence: PresenceService,
    private readonly outbox: EsrvOutbox,
    private readonly longPoll: LongPollCoordinator,
  ) {}

  async afterSessionCommitted(accountId: number, replacedExisting: boolean): Promise<void> {
    if (replacedExisting) await this.deliver(await this.presence.leaveNotices(accountId));
    await this.deliver(await this.presence.enterNotices(accountId));
  }

  async afterLogout(accountId: number): Promise<void> {
    await this.deliver(await this.presence.leaveNotices(accountId));
  }

  async afterMove(
    accountId: number,
    fromAreaId: string,
    toAreaId: string,
    fromCopyId: number | null,
  ): Promise<void> {
    for (const notice of await this.presence.moveNotices(
      accountId,
      fromAreaId,
      toAreaId,
      fromCopyId,
    )) {
      await this.deliver(notice);
    }
  }

  private async deliver(notice: PresenceNotice): Promise<void> {
    if (notice.add && notice.removeNick) {
      throw new Error("A presence notice cannot both add and remove");
    }
    const fragment = notice.add
      ? populationDiff({ add: [notice.add] })
      : notice.removeNick
        ? populationDiff({ remove: [notice.removeNick] })
        : null;
    if (!fragment) throw new Error("Presence notice is missing add or remove");
    for (const accountId of notice.recipientAccountIds) {
      this.outbox.enqueue(accountId, fragment);
      this.longPoll.wake(accountId);
    }
  }
}
