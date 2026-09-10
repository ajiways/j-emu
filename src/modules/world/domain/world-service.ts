import type { Area } from "./area.ts";
import type { AreaLink } from "./area-link.ts";
import type { HuntBotSnapshot } from "./hunt-bot-snapshot.ts";
import type { HuntSpawn } from "./hunt-spawn.ts";
import type { HuntWanderRuntime } from "./hunt-wander-runtime.ts";
import type {
  HuntSpawnOverlay,
  SpawnAcquireResult,
  SpawnLockCommand,
} from "./hunt-spawn-overlay.ts";
import { MissingLinkError } from "./missing-link-error.ts";
import type { HuntAreaWake } from "../ports/hunt-area-wake.ts";
import type { WorldRepository } from "../ports/world-repository.ts";

export class WorldService {
  private wanderStarted = false;

  constructor(
    private readonly world: WorldRepository,
    private readonly overlay: HuntSpawnOverlay,
    private readonly wander: HuntWanderRuntime,
  ) {}

  bindAreaWake(wake: HuntAreaWake): void {
    this.wander.bindWake(wake);
  }

  async startWander(): Promise<void> {
    if (this.wanderStarted) throw new Error("Hunt wander is already started");
    this.wanderStarted = true;
    for (const entry of await this.world.listHuntSpawns()) {
      this.wander.ensure(entry.areaId, entry.spawn);
    }
  }

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
    this.wander.ensure(command.areaId, spawn);
    const result = this.overlay.acquire({
      areaId: command.areaId,
      spawnId: spawn.id,
      fightId: command.fightId,
      ownerAccountId: command.ownerAccountId,
    });
    if (result.ok) this.wander.freeze(command.areaId, spawn, true);
    return result;
  }

  async releaseSpawn(command: { areaId: string; spawnId: number }): Promise<void> {
    const spawn = await this.spawn(command.areaId, command.spawnId);
    if (!spawn) {
      throw new Error(`Hunt spawn ${command.spawnId} is not present in area ${command.areaId}`);
    }
    this.overlay.release(command.areaId, command.spawnId);
    this.wander.respawn(command.areaId, spawn);
  }

  releaseSpawnForFight(fightId: string): { areaId: string; spawnId: number } | null {
    const released = this.overlay.releaseFight(fightId);
    if (!released) return null;
    this.wander.respawnById(released.areaId, released.spawnId);
    return released;
  }

  async huntSnapshot(areaId: string): Promise<readonly HuntBotSnapshot[]> {
    const area = await this.area(areaId);
    return this.wander.snapshot(area.id, area.spawns, (spawnId) =>
      this.overlay.fightId(area.id, spawnId),
    );
  }
}
