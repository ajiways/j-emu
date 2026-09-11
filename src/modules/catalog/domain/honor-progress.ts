import type { CommonConfBlock } from "../../content/domain/bootstrap-content.ts";

export type HonorRankCatalog = Readonly<{
  titles: readonly string[];
  honorToReach: readonly number[];
}>;

export type HonorProgress = Readonly<{
  rank: number;
  title: string;
  honor: number;
  honorMin: number;
  honorMax: number;
  honorStatus: number;
}>;

export function honorRankCatalogFromConf(conf: CommonConfBlock): HonorRankCatalog {
  if (!Array.isArray(conf.rank_info)) throw new Error("common_conf.rank_info must be an array");
  if (!Array.isArray(conf.rank_table)) throw new Error("common_conf.rank_table must be an array");
  if (conf.rank_info.length < 1) throw new Error("common_conf.rank_info is empty");
  if (conf.rank_table.length < 1) throw new Error("common_conf.rank_table is empty");
  const titles: string[] = [];
  for (let index = 0; index < conf.rank_info.length; index += 1) {
    const info = conf.rank_info[index];
    if (!info || typeof info !== "object" || Array.isArray(info)) {
      throw new Error(`rank_info ${index} must be an object`);
    }
    const infoRow = info as Record<string, unknown>;
    if (infoRow.id !== index) throw new Error(`rank_info ${index} id must be ${index}`);
    if (typeof infoRow.title !== "string" || !infoRow.title) {
      throw new Error(`rank_info ${index} title is required`);
    }
    titles.push(infoRow.title);
  }
  const honorToReach: number[] = [];
  for (let index = 0; index < conf.rank_table.length; index += 1) {
    const table = conf.rank_table[index];
    if (!table || typeof table !== "object" || Array.isArray(table)) {
      throw new Error(`rank_table ${index} must be an object`);
    }
    const tableRow = table as Record<string, unknown>;
    const rankKey = String(tableRow.rank);
    if (rankKey !== String(index)) throw new Error(`rank_table ${index} rank must be ${index}`);
    const honor = Number(tableRow.honor);
    if (!Number.isInteger(honor) || honor < 0) {
      throw new Error(`rank_table ${index} honor is invalid`);
    }
    if (!titles[index]) {
      throw new Error(`rank_table ${index} has no rank_info title`);
    }
    honorToReach.push(honor);
  }
  return { titles, honorToReach };
}

export function honorRankTitle(catalog: HonorRankCatalog, rankId: number): string {
  if (!Number.isInteger(rankId) || rankId < 0) throw new Error("Rank id is required");
  const title = catalog.titles[rankId];
  if (!title) throw new Error(`Honor rank ${rankId} is missing from the catalog`);
  return title;
}

function minLevelForRank(rankId: number): number {
  if (!Number.isInteger(rankId) || rankId < 0) throw new Error("Rank id is required");
  if (rankId <= 3) return 1;
  if (rankId <= 30) return rankId + 4;
  return 35;
}

export function honorProgress(
  catalog: HonorRankCatalog,
  rawHonor: number,
  level: number,
): HonorProgress {
  if (!Number.isInteger(rawHonor) || rawHonor < 0)
    throw new Error("Honor must be a non-negative integer");
  if (!Number.isInteger(level) || level < 1) throw new Error("Level must be a positive integer");
  const cap = honorCapForLevel(catalog, level);
  const honor = Math.min(rawHonor, cap);
  let rank = 0;
  for (let id = 0; id < catalog.honorToReach.length; id += 1) {
    const need = requireHonorThreshold(catalog, id);
    if (honor < need || minLevelForRank(id) > level) break;
    rank = id;
  }
  const honorMin = requireHonorThreshold(catalog, rank);
  const next = rank + 1;
  const nextNeed = catalog.honorToReach[next];
  const nextOpen = nextNeed !== undefined && minLevelForRank(next) <= level;
  const honorMax = nextOpen ? nextNeed : honorMin;
  return {
    rank,
    title: honorRankTitle(catalog, rank),
    honor,
    honorMin,
    honorMax,
    honorStatus: nextOpen ? 0 : 1,
  };
}

export function honorCapForLevel(catalog: HonorRankCatalog, level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new Error("Level must be a positive integer");
  const last = catalog.honorToReach[catalog.honorToReach.length - 1];
  if (last === undefined) throw new Error("Honor rank catalog is empty");
  for (let id = 1; id < catalog.honorToReach.length; id += 1) {
    if (minLevelForRank(id) > level) {
      return requireHonorThreshold(catalog, id - 1);
    }
  }
  return last;
}

function requireHonorThreshold(catalog: HonorRankCatalog, rankId: number): number {
  const need = catalog.honorToReach[rankId];
  if (need === undefined) throw new Error(`Honor threshold for rank ${rankId} is missing`);
  return need;
}
