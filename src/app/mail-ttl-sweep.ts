import type { Clock } from "../shared/kernel/clock.ts";
import type { DelayScheduler } from "../shared/kernel/delay-scheduler.ts";
import { MAIL_SWEEP_INTERVAL_MS } from "../modules/mail/domain/mail-ttl.ts";
import type { MailService } from "../modules/mail/application/mail-service.ts";

const TOKEN = "mail-ttl-sweep";

export class MailTtlSweep {
  constructor(
    private readonly mail: Pick<MailService, "sweepExpired">,
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
      dueAt: new Date(this.clock.now().getTime() + MAIL_SWEEP_INTERVAL_MS),
      run: async () => {
        await this.mail.sweepExpired();
        this.arm();
      },
    });
  }
}
