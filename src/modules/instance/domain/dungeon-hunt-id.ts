/** Stable numeric hunt id from copy+spawn (client needs unique id). Dump `dungeonHuntId`. */
export function dungeonHuntId(copyId: number, spawnKey: string): number {
  if (!Number.isInteger(copyId) || copyId < 1) {
    throw new Error("Dungeon hunt copy id is required");
  }
  if (!spawnKey) throw new Error("Dungeon hunt spawn key is required");
  let hash = 0;
  const seed = `${copyId}:${spawnKey}`;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return 100_000_000 + (hash % 800_000_000);
}
