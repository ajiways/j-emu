import type { Clock } from "../shared/kernel/clock.ts";
import type { DelayScheduler } from "../shared/kernel/delay-scheduler.ts";
import { FARM_SWEEP_CATCHUP_MS } from "../modules/professions/domain/farm-formulas.ts";
import type {
  FarmFinishNotice,
  ProfessionsService,
} from "../modules/professions/application/professions-service.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { EsrvOutbox } from "../modules/jugger-wire/application/esrv-outbox.ts";
import { buildUserBag } from "../modules/jugger-wire/application/user-bag-block.ts";

const TOKEN = "farm-sweep";

export class FarmSweep {
  constructor(
    private readonly professions: ProfessionsService,
    private readonly delay: DelayScheduler,
    private readonly clock: Clock,
    private readonly outbox: EsrvOutbox,
    private readonly wake: Readonly<{ wake(accountId: number): void }>,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly catalog: Catalog,
  ) {}

  start(): void {
    void this.runOnce();
    this.arm();
  }

  async close(): Promise<void> {
    this.delay.cancel(TOKEN);
  }

  private arm(): void {
    this.delay.schedule({
      token: TOKEN,
      dueAt: new Date(this.clock.now().getTime() + FARM_SWEEP_CATCHUP_MS),
      run: async () => {
        await this.runOnce();
        this.arm();
      },
    });
  }

  private async runOnce(): Promise<void> {
    const notices = await this.professions.finishDue();
    for (const notice of notices) await this.push(notice);
  }

  private async push(notice: FarmFinishNotice): Promise<void> {
    const fragment: Record<string, unknown> = {
      "assistant|farm_result": { status: 100, finished: notice.finished },
      "assistant|info": await this.professions.info(notice.heroId),
    };
    if (notice.bagDirty) {
      const hero = await this.characters.getById(notice.heroId);
      if (!hero) throw new Error(`Hero ${notice.heroId} is missing`);
      fragment["user|bag"] = await buildUserBag(hero, this.inventory, this.catalog);
    }
    this.outbox.enqueue(notice.accountId, fragment);
    this.wake.wake(notice.accountId);
  }
}
