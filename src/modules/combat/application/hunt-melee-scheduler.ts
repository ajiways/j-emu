import type { Clock } from "../../../shared/kernel/clock.ts";
import { requirePresent } from "../../../shared/kernel/require-present.ts";
import type { CombatDelay } from "../ports/combat-delay.ts";

export class HuntMeleeScheduler {
  constructor(
    private readonly delay: CombatDelay,
    private readonly clock: Clock,
  ) {
    requirePresent(delay, "Combat delay is required");
    requirePresent(clock, "Combat clock is required");
  }

  now(): Date {
    return this.clock.now();
  }

  cancel(token: string): void {
    this.delay.cancel(token);
  }

  schedule(token: string, delayMs: number, run: () => void | Promise<void>): void {
    if (!Number.isInteger(delayMs) || delayMs < 1) {
      throw new Error("Combat follow-up delay must be a positive integer");
    }
    this.delay.schedule({
      token,
      dueAt: new Date(this.clock.now().getTime() + delayMs),
      run,
    });
  }
}
