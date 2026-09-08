import type { Clock } from "../../src/shared/kernel/clock.ts";

export class FakeClock implements Clock {
  constructor(private currentMs: number) {
    if (!Number.isFinite(currentMs)) throw new Error("FakeClock requires a finite timestamp");
  }

  now(): Date {
    return new Date(this.currentMs);
  }

  unixSeconds(): number {
    return Math.floor(this.now().getTime() / 1000);
  }

  advanceSeconds(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error("FakeClock advance requires a non-negative finite number");
    }
    this.currentMs += seconds * 1000;
  }

  rewindSeconds(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error("FakeClock rewind requires a positive finite number");
    }
    this.currentMs -= seconds * 1000;
  }
}
