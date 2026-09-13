import { parseDecimalId, requireWireIdentity } from "../shared/kernel/decimal-id.ts";
import type { FightFinishedNotice } from "../modules/combat/ports/fight-terminal-observer.ts";
import type { HuntAreaFanout } from "../modules/jugger-wire/application/hunt-area-fanout.ts";
import type { EsrvOutbox } from "../modules/jugger-wire/application/esrv-outbox.ts";
import type { DungeonHuntWorld } from "../modules/instance/application/dungeon-hunt-world.ts";
import type { InstanceService } from "../modules/instance/application/instance-service.ts";
import { instanceConf } from "../modules/instance/domain/instance-wire.ts";
import type { HuntLockRelease } from "./hunt-lock-release.ts";
import type { InstanceDesk } from "./instance-desk.ts";
import type { DungeonPersonalGrant } from "./dungeon-personal-grant.ts";

export class InstanceHuntLockRelease {
  constructor(
    private readonly world: HuntLockRelease,
    private readonly dungeonHunt: DungeonHuntWorld,
    private readonly instances: InstanceService,
    private readonly desk: Pick<InstanceDesk, "kickIfPending">,
    private readonly fanout: HuntAreaFanout,
    private readonly grant: DungeonPersonalGrant,
    private readonly outbox: EsrvOutbox,
    private readonly wake: Readonly<{ wake(accountId: number): void }>,
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
    const tick = this.grant.takeTick(notice.fightId);
    if (tick && tick.hasClear && tick.next !== tick.prev) {
      const conf = instanceConf(tick.artikulId, true, {
        finish: tick.finish,
        value: tick.next,
      });
      for (const accountId of tick.accountIds) {
        this.outbox.enqueue(accountId, { "common|instance_conf": conf });
        this.wake.wake(accountId);
      }
    }
    await this.fanout.wakeArea(released.areaId, released.copyId);
    await this.desk.kickIfPending(released.copyId);
  }
}
