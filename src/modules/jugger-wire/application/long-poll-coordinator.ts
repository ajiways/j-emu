export class LongPollCoordinator {
  // Process-local waiters. Restart drops them; clients retry esrv/fproxy poll.
  // No persisted cursor: a poll either returns queued bytes or waits again.
  private readonly active = new Set<AbortController>();
  private stopping = false;

  wait(milliseconds: number, signal: AbortSignal): Promise<"timeout" | "aborted" | "shutdown"> {
    if (!Number.isInteger(milliseconds) || milliseconds < 1) {
      throw new Error("Long-poll duration must be a positive integer");
    }
    if (this.stopping) return Promise.resolve("shutdown");
    if (signal.aborted) return Promise.resolve("aborted");
    return new Promise((resolve) => {
      const internal = new AbortController();
      this.active.add(internal);
      const cleanup = () => {
        this.active.delete(internal);
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
        resolve(this.stopping ? "shutdown" : "aborted");
      };
      const clientAbort = () => internal.abort();
      signal.addEventListener("abort", clientAbort, { once: true });
      internal.signal.addEventListener("abort", internalAbort, { once: true });
      if (this.stopping) {
        internal.abort();
      }
    });
  }

  shutdown(): void {
    this.stopping = true;
    for (const controller of this.active) controller.abort();
  }
}
