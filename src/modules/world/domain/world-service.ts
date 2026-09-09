import { parseDecimalId, requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { Area } from "./area.ts";
import type { AreaLink } from "./area-link.ts";
import type { HuntBotSnapshot } from "./hunt-bot-snapshot.ts";
import type { HuntSpawn } from "./hunt-spawn.ts";
import type {
  HuntSpawnOverlay,
  SpawnAcquireResult,
  SpawnLockCommand,
} from "./hunt-spawn-overlay.ts";
import { MissingLinkError } from "./missing-link-error.ts";
import type { WorldRepository } from "../ports/world-repository.ts";

const IDLE_SPAWN_FIGHT_ID = 0;

export class WorldService {
  constructor(
    private readonly world: WorldRepository,
    private readonly overlay: HuntSpawnOverlay,
  ) {}

  async area(id: string): Promise<Area> {
    const area = await this.world.findArea(id);
    if (!area) throw new Error(`Unknown area ${id}`);
    return area;
  }

  async linksFrom(areaId: string): Promise<readonly AreaLink[]> {
    if (!areaId) throw new Error("Area id is required");
    return this.world.listLinksFrom(areaId);
  }

  async requireLink(fromAreaId: string, toAreaId: string): Promise<AreaLink> {
    if (!fromAreaId) throw new Error("fromAreaId is required");
    if (!toAreaId) throw new Error("toAreaId is required");
    const link = await this.world.findLink(fromAreaId, toAreaId);
    if (!link) throw new MissingLinkError();
    return link;
  }

  async spawn(areaId: string, spawnId: number): Promise<HuntSpawn | null> {
    const found = (await this.area(areaId)).spawns.find((entry) => entry.id === spawnId);
    if (!found) return null;
    return found;
  }

  occupiedFightId(areaId: string, spawnId: number): string | null {
    return this.overlay.fightId(areaId, spawnId);
  }

  async tryAcquireSpawn(command: SpawnLockCommand): Promise<SpawnAcquireResult> {
    const spawn = await this.spawn(command.areaId, command.spawnId);
    if (!spawn) {
      throw new Error(`Hunt spawn ${command.spawnId} is not present in area ${command.areaId}`);
    }
    return this.overlay.acquire({
      areaId: command.areaId,
      spawnId: spawn.id,
      fightId: command.fightId,
      ownerAccountId: command.ownerAccountId,
    });
  }

  async releaseSpawn(command: { areaId: string; spawnId: number }): Promise<void> {
    this.overlay.release(command.areaId, command.spawnId);
  }

  releaseSpawnForFight(fightId: string): { areaId: string; spawnId: number } | null {
    return this.overlay.releaseFight(fightId);
  }

  async huntSnapshot(areaId: string): Promise<readonly HuntBotSnapshot[]> {
    const area = await this.area(areaId);
    return area.spawns.map((spawn) => snapshotBot(spawn, this.overlay.fightId(area.id, spawn.id)));
  }
}

function snapshotBot(spawn: HuntSpawn, fightId: string | null): HuntBotSnapshot {
  return {
    id: spawn.id,
    artikulId: spawn.botId,
    fightId: fightId === null ? IDLE_SPAWN_FIGHT_ID : wireFightId(fightId),
    huntMask: spawn.huntMask,
    positionX: spawn.x,
    positionY: spawn.y,
    prevX: spawn.x,
    prevY: spawn.y,
  };
}

function wireFightId(fightId: string): number {
  return requireWireIdentity(Number(parseDecimalId(fightId, "hunt fight id")), "hunt fight id");
}
