import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { Clock } from "../../../shared/kernel/clock.ts";
import type { DelayScheduler } from "../../../shared/kernel/delay-scheduler.ts";
import { dungeonArea } from "../../catalog/domain/dungeon-definition.ts";
import type { HuntBotSnapshot } from "../../world/domain/hunt-bot-snapshot.ts";
import type { HuntSpawn } from "../../world/domain/hunt-spawn.ts";
import { HuntSpawnOverlay } from "../../world/domain/hunt-spawn-overlay.ts";
import { HuntWanderRuntime } from "../../world/domain/hunt-wander-runtime.ts";
import type { HuntRandom } from "../../world/ports/hunt-random.ts";
import { dungeonSpawnToHunt } from "../domain/dungeon-spawn-to-hunt.ts";
import type { InstanceService } from "./instance-service.ts";
import type {
  DungeonHuntLockCommand,
  DungeonHuntRelease,
  DungeonHuntSpawnHit,
  InstanceHuntWorld,
} from "../ports/instance-hunt.ts";

export class DungeonHuntWorld implements InstanceHuntWorld {
  private readonly overlay = new HuntSpawnOverlay();
  private readonly wander: HuntWanderRuntime;
  private readonly spawnKeys = new Map<string, string>();
  private wake: ((copyId: number, areaId: string) => Promise<void>) | null = null;

  constructor(
    private readonly instances: InstanceService,
    private readonly catalog: Catalog,
    clock: Clock,
    delay: DelayScheduler,
    random: HuntRandom,
  ) {
    this.wander = new HuntWanderRuntime(clock, delay, random);
    this.wander.bindWake({
      wakeArea: async (areaKey) => {
        const parsed = parseWorldKey(areaKey);
        if (!this.wake) return;
        await this.wake(parsed.copyId, parsed.areaId);
      },
    });
  }

  bindWake(wake: (copyId: number, areaId: string) => Promise<void>): void {
    if (this.wake) throw new Error("Dungeon hunt wake is already bound");
    this.wake = wake;
  }

  async snapshot(copyId: number, areaId: string): Promise<readonly HuntBotSnapshot[]> {
    const spawns = await this.liveSpawns(copyId, areaId);
    const areaKey = worldKey(copyId, areaId);
    return this.wander.snapshot(areaKey, spawns, (spawnId) =>
      this.overlay.fightId(areaKey, spawnId),
    );
  }

  async liveSpawns(copyId: number, areaId: string): Promise<readonly HuntSpawn[]> {
    const dungeon = await this.instances.dungeonByArea(areaId);
    if (!dungeon) return [];
    const area = dungeonArea(dungeon, areaId);
    if (!area) return [];
    const killed = new Set(await this.instances.killedSpawnKeys(copyId));
    const spawns: HuntSpawn[] = [];
    for (const spawn of area.spawns) {
      if (killed.has(spawn.spawnKey)) continue;
      const bot = await this.catalog.bot(spawn.huntBotId);
      if (!bot) throw new Error(`Bot catalog entry ${spawn.huntBotId} is missing`);
      const hunt = dungeonSpawnToHunt(copyId, spawn, bot.hunt.speed);
      this.spawnKeys.set(metaKey(copyId, areaId, hunt.id), spawn.spawnKey);
      spawns.push(hunt);
    }
    return spawns;
  }

  async spawn(copyId: number, areaId: string, huntId: number): Promise<DungeonHuntSpawnHit | null> {
    const spawns = await this.liveSpawns(copyId, areaId);
    const found = spawns.find((entry) => entry.id === huntId);
    if (!found) return null;
    const spawnKey = this.spawnKeys.get(metaKey(copyId, areaId, huntId));
    if (!spawnKey) throw new Error(`Dungeon hunt ${huntId} spawn key is missing`);
    return { spawn: found, spawnKey, botId: found.botId };
  }

  occupiedFightId(copyId: number, areaId: string, spawnId: number): string | null {
    return this.overlay.fightId(worldKey(copyId, areaId), spawnId);
  }

  async tryAcquire(command: DungeonHuntLockCommand) {
    const hit = await this.spawn(command.copyId, command.areaId, command.spawnId);
    if (!hit) {
      throw new Error(
        `Hunt spawn ${command.spawnId} is not present in dungeon copy ${command.copyId} area ${command.areaId}`,
      );
    }
    const areaKey = worldKey(command.copyId, command.areaId);
    this.wander.ensure(areaKey, hit.spawn);
    const result = this.overlay.acquire({
      areaId: areaKey,
      spawnId: hit.spawn.id,
      fightId: command.fightId,
      ownerAccountId: command.ownerAccountId,
    });
    if (result.ok) this.wander.freeze(areaKey, hit.spawn, true);
    return result;
  }

  release(copyId: number, areaId: string, spawnId: number): void {
    this.overlay.release(worldKey(copyId, areaId), spawnId);
  }

  peekFight(fightId: string): DungeonHuntRelease | null {
    const peeked = this.overlay.peekFight(fightId);
    if (!peeked) return null;
    const parsed = parseWorldKey(peeked.areaId);
    const spawnKey = this.spawnKeys.get(metaKey(parsed.copyId, parsed.areaId, peeked.spawnId));
    if (!spawnKey) {
      throw new Error(`Dungeon hunt fight ${fightId} is missing spawn key`);
    }
    return {
      copyId: parsed.copyId,
      areaId: parsed.areaId,
      spawnId: peeked.spawnId,
      spawnKey,
    };
  }

  releaseFight(fightId: string): DungeonHuntRelease | null {
    const released = this.overlay.releaseFight(fightId);
    if (!released) return null;
    const parsed = parseWorldKey(released.areaId);
    const spawnKey = this.spawnKeys.get(metaKey(parsed.copyId, parsed.areaId, released.spawnId));
    if (!spawnKey) {
      throw new Error(`Dungeon hunt fight ${fightId} is missing spawn key`);
    }
    return {
      copyId: parsed.copyId,
      areaId: parsed.areaId,
      spawnId: released.spawnId,
      spawnKey,
    };
  }

  forget(copyId: number, areaId: string, spawnId: number): void {
    const areaKey = worldKey(copyId, areaId);
    this.overlay.release(areaKey, spawnId);
    this.wander.forget(areaKey, spawnId);
    this.spawnKeys.delete(metaKey(copyId, areaId, spawnId));
  }
}

function worldKey(copyId: number, areaId: string): string {
  if (!Number.isInteger(copyId) || copyId < 1) throw new Error("Dungeon copy id is required");
  if (!areaId) throw new Error("Area id is required");
  return `dungeon:${copyId}:${areaId}`;
}

function parseWorldKey(areaKey: string): { copyId: number; areaId: string } {
  const match = /^dungeon:(\d+):(.+)$/.exec(areaKey);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Dungeon hunt world key ${areaKey} is invalid`);
  }
  const copyId = Number(match[1]);
  if (!Number.isInteger(copyId) || copyId < 1) {
    throw new Error(`Dungeon hunt world key ${areaKey} is invalid`);
  }
  return { copyId, areaId: match[2] };
}

function metaKey(copyId: number, areaId: string, spawnId: number): string {
  return `${copyId}:${areaId}:${spawnId}`;
}
