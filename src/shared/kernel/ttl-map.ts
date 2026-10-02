import type { Clock } from "./clock.ts";

/**
 * A map whose entries are forgotten `ttlMs` after they were written. Records of a finished fight
 * must not pile up for as long as the process lives; every write drops what has outlived its time
 * (entries stay in write order, so the sweep only looks at the oldest ones).
 */
export class TtlMap<K, V> {
  private readonly entries = new Map<K, Readonly<{ value: V; expiresAtMs: number }>>();

  constructor(
    private readonly ttlMs: number,
    private readonly clock: Clock,
  ) {
    if (!Number.isInteger(ttlMs) || ttlMs < 1)
      throw new Error("TtlMap ttl must be a positive integer");
  }

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAtMs <= this.clock.now().getTime()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  set(key: K, value: V): void {
    const nowMs = this.clock.now().getTime();
    this.sweep(nowMs);
    // A rewritten key moves to the end, so the order stays the order of expiry.
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAtMs: nowMs + this.ttlMs });
  }

  delete(key: K): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  /** Entries held right now, expired ones not yet swept included. */
  get size(): number {
    return this.entries.size;
  }

  private sweep(nowMs: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAtMs > nowMs) return;
      this.entries.delete(key);
    }
  }
}
