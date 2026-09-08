export class ClockRegressionError extends Error {
  constructor(nowSec: number, regenAtSec: number) {
    super(`Clock regression: unix second ${nowSec} is before regen_at ${regenAtSec}`);
    this.name = "ClockRegressionError";
  }
}
