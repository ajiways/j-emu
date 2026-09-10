export type InstanceCopyRecord = Readonly<{
  id: number;
  copyType: "dungeon" | "bg";
  artikulId: string;
  createdUnix: number;
  expiresUnix: number;
  pendingKick: 0 | 1;
}>;

export type InstanceBindRecord = Readonly<{
  heroId: number;
  dungeonArtikulId: string;
  copyId: number;
  boundUnix: number;
}>;

export function isCopyLive(copy: InstanceCopyRecord, nowUnix: number): boolean {
  if (!Number.isInteger(nowUnix) || nowUnix < 1) {
    throw new Error("Copy live check requires a positive unix timestamp");
  }
  return copy.expiresUnix > nowUnix;
}
