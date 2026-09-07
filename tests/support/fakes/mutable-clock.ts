import type { Clock } from "../../../src/shared/kernel/clock.ts";

export class MutableClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  unixSeconds(): number {
    return Math.floor(this.current.getTime() / 1000);
  }

  set(value: Date): void {
    this.current = value;
  }

  advanceMs(delta: number): void {
    this.current = new Date(this.current.getTime() + delta);
  }
}
