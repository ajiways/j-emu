export class LongPollCoordinator {
  // Process-local waiters. Restart drops them; clients retry esrv/fproxy poll.
  // No persisted cursor: a poll either returns queued bytes or waits again.
  private readonly unscoped = new Set<AbortController>();
  private readonly byAccount = new Map<number, Set<AbortController>>();
  private stopping = false;

  wait(
    milliseconds: number,
    signal: AbortSignal,
    accountId?: number,
  ): Promise<"timeout" | "aborted" | "shutdown" | "woken"> {
    if (!Number.isInteger(milliseconds) || milliseconds < 1) {
      throw new Error("Long-poll duration must be a positive integer");
    }
    if (accountId !== undefined && (!Number.isInteger(accountId) || accountId < 1)) {
      throw new Error("Long-poll account id must be a positive integer");
    }
    if (this.stopping) return Promise.resolve("shutdown");
    if (signal.aborted) return Promise.resolve("aborted");
    return new Promise((resolve) => {
      const internal = new AbortController();
      const bucket = this.bucket(accountId);
      bucket.add(internal);
      const cleanup = () => {
        bucket.delete(internal);
        if (accountId !== undefined && bucket.size === 0) this.byAccount.delete(accountId);
        signal.removeEventListener("abort", clientAbort);
        internal.signal.removeEventListener("abort", internalAbort);
      };
      const timeout = setTimeout(() => {
        cleanup();
        resolve("timeout");
      }, milliseconds);
      const internalAbort = () => {
        clearTimeout(timeout);
        cleanup();
        if (this.stopping) resolve("shutdown");
        else if (signal.aborted) resolve("aborted");
        else resolve("woken");
      };
      const clientAbort = () => internal.abort();
      signal.addEventListener("abort", clientAbort, { once: true });
      internal.signal.addEventListener("abort", internalAbort, { once: true });
      if (this.stopping) {
        internal.abort();
      }
    });
  }

  wake(accountId: number): void {
    if (!Number.isInteger(accountId) || accountId < 1) {
      throw new Error("Long-poll account id must be a positive integer");
    }
    const waiters = this.byAccount.get(accountId);
    if (!waiters) return;
    for (const controller of [...waiters]) controller.abort();
  }

  shutdown(): void {
    this.stopping = true;
    for (const controller of this.unscoped) controller.abort();
    for (const waiters of this.byAccount.values()) {
      for (const controller of waiters) controller.abort();
    }
  }

  private bucket(accountId: number | undefined): Set<AbortController> {
    if (accountId === undefined) return this.unscoped;
    const existing = this.byAccount.get(accountId);
    if (existing) return existing;
    const created = new Set<AbortController>();
    this.byAccount.set(accountId, created);
    return created;
  }
}
