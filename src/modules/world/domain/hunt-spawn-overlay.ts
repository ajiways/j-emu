import { parseDecimalId, requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";

export type SpawnLockCommand = Readonly<{
  areaId: string;
  spawnId: number;
  fightId: string;
  ownerAccountId: number;
}>;

export type SpawnAcquireResult =
  Readonly<{ ok: true }> | Readonly<{ ok: false; reason: "busy"; fightId: string }>;

type SpawnLock = Readonly<{
  areaId: string;
  spawnId: number;
  fightId: string;
  ownerAccountId: number;
}>;

export class HuntSpawnOverlay {
  private readonly bySpawn = new Map<string, SpawnLock>();
  private readonly byFight = new Map<string, string>();

  acquire(command: SpawnLockCommand): SpawnAcquireResult {
    const lock = requireLock(command);
    const key = spawnKey(lock.areaId, lock.spawnId);
    const existing = this.bySpawn.get(key);
    if (existing && existing.ownerAccountId !== lock.ownerAccountId) {
      return { ok: false, reason: "busy", fightId: existing.fightId };
    }
    if (existing) this.forgetFight(existing.fightId);
    this.bySpawn.set(key, lock);
    this.byFight.set(lock.fightId, key);
    return { ok: true };
  }

  release(areaId: string, spawnId: number): void {
    const key = spawnKey(areaId, spawnId);
    const existing = this.bySpawn.get(key);
    if (!existing) return;
    this.bySpawn.delete(key);
    this.forgetFight(existing.fightId);
  }

  releaseFight(fightId: string): { areaId: string; spawnId: number } | null {
    const key = this.byFight.get(requireFightId(fightId));
    if (!key) return null;
    const lock = this.bySpawn.get(key);
    if (!lock) throw new Error(`Hunt overlay fight ${fightId} is missing its spawn lock`);
    this.release(lock.areaId, lock.spawnId);
    return { areaId: lock.areaId, spawnId: lock.spawnId };
  }

  fightId(areaId: string, spawnId: number): string | null {
    const existing = this.bySpawn.get(spawnKey(areaId, spawnId));
    if (!existing) return null;
    return existing.fightId;
  }

  private forgetFight(fightId: string): void {
    this.byFight.delete(fightId);
  }
}

function requireLock(command: SpawnLockCommand): SpawnLock {
  requireWireIdentity(command.ownerAccountId, "hunt lock owner");
  return {
    areaId: command.areaId,
    spawnId: command.spawnId,
    fightId: requireFightId(command.fightId),
    ownerAccountId: command.ownerAccountId,
  };
}

function requireFightId(fightId: string): string {
  return String(requireWireIdentity(Number(parseDecimalId(fightId, "fight id")), "fight id"));
}

function spawnKey(areaId: string, spawnId: number): string {
  if (!areaId) throw new Error("Area id is required");
  if (!Number.isInteger(spawnId) || spawnId <= 0) {
    throw new Error(`Hunt spawn id ${spawnId} is invalid`);
  }
  return `${areaId}:${spawnId}`;
}
