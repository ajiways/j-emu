import type { HuntBotSnapshot } from "../../world/domain/hunt-bot-snapshot.ts";
import type { HuntSpawn } from "../../world/domain/hunt-spawn.ts";
import type { SpawnAcquireResult } from "../../world/domain/hunt-spawn-overlay.ts";

export type DungeonHuntLockCommand = Readonly<{
  copyId: number;
  areaId: string;
  spawnId: number;
  fightId: string;
  ownerAccountId: number;
}>;

export type DungeonHuntRelease = Readonly<{
  copyId: number;
  areaId: string;
  spawnId: number;
  spawnKey: string;
}>;

export type DungeonHuntSpawnHit = Readonly<{
  spawn: HuntSpawn;
  spawnKey: string;
  botId: number;
}>;

export interface InstanceHuntWorld {
  snapshot(copyId: number, areaId: string): Promise<readonly HuntBotSnapshot[]>;
  liveSpawns(copyId: number, areaId: string): Promise<readonly HuntSpawn[]>;
  spawn(copyId: number, areaId: string, huntId: number): Promise<DungeonHuntSpawnHit | null>;
  occupiedFightId(copyId: number, areaId: string, spawnId: number): string | null;
  tryAcquire(command: DungeonHuntLockCommand): Promise<SpawnAcquireResult>;
  release(copyId: number, areaId: string, spawnId: number): void;
  releaseFight(fightId: string): DungeonHuntRelease | null;
  peekFight(fightId: string): DungeonHuntRelease | null;
  forget(copyId: number, areaId: string, spawnId: number): void;
  bindWake(wake: (copyId: number, areaId: string) => Promise<void>): void;
}
