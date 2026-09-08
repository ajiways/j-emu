import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";

export class EsrvOutbox {
  private readonly pending = new Map<number, object[]>();

  enqueue(accountId: number, fragment: object): void {
    requireWireIdentity(accountId, "account id");
    const queue = this.pending.get(accountId) ?? [];
    queue.push(fragment);
    this.pending.set(accountId, queue);
  }

  peek(accountId: number): boolean {
    requireWireIdentity(accountId, "account id");
    return (this.pending.get(accountId)?.length ?? 0) > 0;
  }

  take(accountId: number): object[] {
    requireWireIdentity(accountId, "account id");
    const queue = this.pending.get(accountId) ?? [];
    this.pending.delete(accountId);
    return queue;
  }
}
