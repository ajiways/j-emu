import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";

export type EsrvOutboxEntry = Readonly<{
  fragment: object;
  channel: string | null;
}>;

export class EsrvOutbox {
  private readonly pending = new Map<number, EsrvOutboxEntry[]>();

  enqueue(accountId: number, fragment: object, channel?: string): void {
    requireWireIdentity(accountId, "account id");
    const queue = this.pending.get(accountId) ?? [];
    queue.push({ fragment, channel: channel === undefined ? null : channel });
    this.pending.set(accountId, queue);
  }

  peek(accountId: number): boolean {
    requireWireIdentity(accountId, "account id");
    return (this.pending.get(accountId)?.length ?? 0) > 0;
  }

  take(accountId: number): EsrvOutboxEntry[] {
    requireWireIdentity(accountId, "account id");
    const queue = this.pending.get(accountId) ?? [];
    this.pending.delete(accountId);
    return queue;
  }
}
