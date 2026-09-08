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
    if (!Number.isFinite(seconds)) throw new Error("FakeClock advance requires a finite number");
    this.currentMs += seconds * 1000;
  }
}
