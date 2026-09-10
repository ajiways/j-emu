import type { Clock } from "../../../shared/kernel/clock.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import type { DungeonCatalog } from "../../catalog/ports/dungeon-catalog.ts";
import type { DungeonDefinition } from "../../catalog/domain/dungeon-definition.ts";
import { dungeonContainsArea } from "../../catalog/domain/dungeon-definition.ts";
import { isCopyLive, type InstanceCopyRecord } from "../domain/instance-copy.ts";
import { InstanceDeniedError } from "../domain/instance-denied-error.ts";
import type { InstanceRepository } from "../ports/instance-repository.ts";

export type EnterCopyResult = Readonly<{
  dungeon: DungeonDefinition;
  copy: InstanceCopyRecord;
  created: boolean;
}>;

export class InstanceService {
  constructor(
    private readonly copies: InstanceRepository,
    private readonly dungeons: DungeonCatalog,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  dungeonByStartArea(areaId: string): Promise<DungeonDefinition | null> {
    return this.dungeons.byStartArea(areaId);
  }

  dungeonByArea(areaId: string): Promise<DungeonDefinition | null> {
    return this.dungeons.byArea(areaId);
  }

  dungeonByArtikul(artikulId: string): Promise<DungeonDefinition | null> {
    return this.dungeons.byArtikul(artikulId);
  }

  async requireLiveCopy(copyId: number): Promise<InstanceCopyRecord> {
    const copy = await this.copies.lockCopy(copyId);
    if (!copy) {
      throw new InstanceDeniedError(2, "Вы уже привязаны к инстансу. Дождитесь сброса сервера.");
    }
    if (!isCopyLive(copy, this.clock.unixSeconds())) {
      throw new InstanceDeniedError(2, "Время жизни инстанса истекло. Дождитесь сброса сервера.");
    }
    return copy;
  }

  async enterCopy(
    heroId: number,
    heroLevel: number,
    destAreaId: string,
    partyMateCopyIds: readonly number[],
  ): Promise<EnterCopyResult> {
    const dungeon = await this.dungeons.byStartArea(destAreaId);
    if (!dungeon) throw new Error(`Area ${destAreaId} is not a dungeon start`);
    if (heroLevel < dungeon.levelMin) {
      throw new InstanceDeniedError(
        204,
        `Вход в данный инстанс доступен персонажам с ${dungeon.levelMin} уровня!`,
      );
    }
    return this.unitOfWork.run(async () => {
      const bind = await this.copies.getBind(heroId, dungeon.artikulId);
      let copy: InstanceCopyRecord;
      let created = false;
      if (bind) {
        copy = await this.requireLiveCopy(bind.copyId);
      } else {
        const mate = await this.firstLiveMateCopy(dungeon.artikulId, partyMateCopyIds);
        if (mate) {
          copy = mate;
        } else {
          copy = await this.createCopy(dungeon);
          created = true;
        }
      }
      if (!isCopyLive(copy, this.clock.unixSeconds())) {
        throw new InstanceDeniedError(2, "инстанс недоступен");
      }
      await this.copies.upsertBind(heroId, dungeon.artikulId, copy.id, this.clock.unixSeconds());
      return { dungeon, copy, created };
    });
  }

  async markSpawnKilled(copyId: number, spawnKey: string): Promise<void> {
    if (!spawnKey) throw new Error("Killed spawn key is required");
    await this.unitOfWork.run(async () => {
      const copy = await this.copies.lockCopy(copyId);
      if (!copy) throw new Error(`Instance copy ${copyId} is missing`);
      await this.copies.markSpawnKilled(copyId, spawnKey);
    });
  }

  killedSpawnKeys(copyId: number): Promise<readonly string[]> {
    return this.copies.killedSpawnKeys(copyId);
  }

  listExpired(): Promise<readonly InstanceCopyRecord[]> {
    return this.copies.listExpired(this.clock.unixSeconds());
  }

  lockCopy(copyId: number): Promise<InstanceCopyRecord | null> {
    return this.copies.lockCopy(copyId);
  }

  getCopy(copyId: number): Promise<InstanceCopyRecord | null> {
    return this.copies.getCopy(copyId);
  }

  setPendingKick(copyId: number, pending: boolean): Promise<void> {
    return this.copies.setPendingKick(copyId, pending);
  }

  isDungeonArea(dungeon: DungeonDefinition, areaId: string): boolean {
    return dungeonContainsArea(dungeon, areaId);
  }

  private async firstLiveMateCopy(
    artikulId: string,
    partyMateCopyIds: readonly number[],
  ): Promise<InstanceCopyRecord | null> {
    for (const copyId of partyMateCopyIds) {
      if (!Number.isInteger(copyId) || copyId < 1) continue;
      const copy = await this.copies.lockCopy(copyId);
      if (!copy) continue;
      if (copy.artikulId !== artikulId) continue;
      if (!isCopyLive(copy, this.clock.unixSeconds())) continue;
      return copy;
    }
    return null;
  }

  private createCopy(dungeon: DungeonDefinition): Promise<InstanceCopyRecord> {
    const createdUnix = this.clock.unixSeconds();
    return this.copies.insertCopy({
      copyType: "dungeon",
      artikulId: dungeon.artikulId,
      createdUnix,
      expiresUnix: createdUnix + dungeon.durationSec,
      pendingKick: 0,
    });
  }

  createBgCopy(artikulId: string, durationSec: number): Promise<InstanceCopyRecord> {
    if (!artikulId) throw new Error("Battleground copy artikul is required");
    if (!Number.isInteger(durationSec) || durationSec < 1) {
      throw new Error("Battleground copy duration must be a positive integer");
    }
    const createdUnix = this.clock.unixSeconds();
    return this.copies.insertCopy({
      copyType: "bg",
      artikulId,
      createdUnix,
      expiresUnix: createdUnix + durationSec,
      pendingKick: 0,
    });
  }
}
