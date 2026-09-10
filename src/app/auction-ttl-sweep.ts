import type { Clock } from "../shared/kernel/clock.ts";
import type { DelayScheduler } from "../shared/kernel/delay-scheduler.ts";
import { AUCTION_SWEEP_INTERVAL_MS } from "../modules/auction/domain/auction-ttl.ts";
import type { AuctionExpiry } from "./auction-expiry.ts";

const TOKEN = "auction-ttl-sweep";

export class AuctionTtlSweep {
  constructor(
    private readonly expiry: Pick<AuctionExpiry, "sweep">,
    private readonly delay: DelayScheduler,
    private readonly clock: Clock,
  ) {}

  start(): void {
    this.arm();
  }

  async close(): Promise<void> {
    this.delay.cancel(TOKEN);
  }

  private arm(): void {
    this.delay.schedule({
      token: TOKEN,
      dueAt: new Date(this.clock.now().getTime() + AUCTION_SWEEP_INTERVAL_MS),
      run: async () => {
        await this.expiry.sweep();
        this.arm();
      },
    });
  }
}
