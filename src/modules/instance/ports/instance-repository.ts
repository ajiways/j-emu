import type { InstanceBindRecord, InstanceCopyRecord } from "../domain/instance-copy.ts";

export type NewInstanceCopy = Readonly<{
  copyType: "dungeon";
  artikulId: string;
  createdUnix: number;
  expiresUnix: number;
  pendingKick: 0 | 1;
}>;

export interface InstanceRepository {
  lockCopy(copyId: number): Promise<InstanceCopyRecord | null>;
  getCopy(copyId: number): Promise<InstanceCopyRecord | null>;
  insertCopy(values: NewInstanceCopy): Promise<InstanceCopyRecord>;
  setPendingKick(copyId: number, pending: boolean): Promise<void>;
  listExpired(nowUnix: number): Promise<readonly InstanceCopyRecord[]>;
  getBind(heroId: number, dungeonArtikulId: string): Promise<InstanceBindRecord | null>;
  upsertBind(
    heroId: number,
    dungeonArtikulId: string,
    copyId: number,
    boundUnix: number,
  ): Promise<void>;
  killedSpawnKeys(copyId: number): Promise<readonly string[]>;
  markSpawnKilled(copyId: number, spawnKey: string): Promise<void>;
}
