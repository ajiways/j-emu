import { parseDecimalId, requireWireIdentity } from "../shared/kernel/decimal-id.ts";
import type { FightFinishedNotice } from "../modules/combat/ports/fight-terminal-observer.ts";
import type { HuntAreaFanout } from "../modules/jugger-wire/application/hunt-area-fanout.ts";
import type { WorldService } from "../modules/world/domain/world-service.ts";

export class HuntLockRelease {
  constructor(
    private readonly world: WorldService,
    private readonly fanout: HuntAreaFanout,
  ) {}

  async afterFinished(notice: FightFinishedNotice): Promise<void> {
    requireWireIdentity(notice.accountId, "account id");
    parseDecimalId(notice.fightId, "fight id");
    const released = this.world.releaseSpawnForFight(notice.fightId);
    if (!released) return;
    await this.fanout.wakeArea(released.areaId);
  }
}
