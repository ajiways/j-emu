import type { Clock } from "../shared/kernel/clock.ts";
import type { DelayScheduler } from "../shared/kernel/delay-scheduler.ts";
import { INSTANCE_SWEEP_INTERVAL_MS } from "../modules/instance/domain/instance-ttl.ts";
import type { InstanceDesk } from "./instance-desk.ts";

const TOKEN = "instance-ttl-sweep";

export class InstanceTtlSweep {
  constructor(
    private readonly desk: Pick<InstanceDesk, "sweepExpired">,
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
      dueAt: new Date(this.clock.now().getTime() + INSTANCE_SWEEP_INTERVAL_MS),
      run: async () => {
        await this.desk.sweepExpired();
        this.arm();
      },
    });
  }
}
