import type { Clock } from "./clock.ts";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  unixSeconds(): number {
    return Math.floor(this.now().getTime() / 1000);
  }
}
