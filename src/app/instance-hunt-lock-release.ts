import { parseDecimalId, requireWireIdentity } from "../shared/kernel/decimal-id.ts";
import type { FightFinishedNotice } from "../modules/combat/ports/fight-terminal-observer.ts";
import type { HuntAreaFanout } from "../modules/jugger-wire/application/hunt-area-fanout.ts";
import type { DungeonHuntWorld } from "../modules/instance/application/dungeon-hunt-world.ts";
import type { InstanceService } from "../modules/instance/application/instance-service.ts";
import type { HuntLockRelease } from "./hunt-lock-release.ts";
import type { InstanceDesk } from "./instance-desk.ts";

export class InstanceHuntLockRelease {
  constructor(
    private readonly world: HuntLockRelease,
    private readonly dungeonHunt: DungeonHuntWorld,
    private readonly instances: InstanceService,
    private readonly desk: Pick<InstanceDesk, "kickIfPending">,
    private readonly fanout: HuntAreaFanout,
  ) {}

  async afterFinished(notice: FightFinishedNotice): Promise<void> {
    requireWireIdentity(notice.accountId, "account id");
    parseDecimalId(notice.fightId, "fight id");
    const released = this.dungeonHunt.releaseFight(notice.fightId);
    if (!released) {
      await this.world.afterFinished(notice);
      return;
    }
    if (notice.outcome === "win") {
      await this.instances.markSpawnKilled(released.copyId, released.spawnKey);
      this.dungeonHunt.forget(released.copyId, released.areaId, released.spawnId);
    }
    await this.fanout.wakeArea(released.areaId, released.copyId);
    await this.desk.kickIfPending(released.copyId);
  }
}
