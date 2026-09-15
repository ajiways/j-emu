import { FINISHED_FIGHT_PAGE_SIZE } from "../domain/finished-fight-retention.ts";
import type { FinishedFightListQuery } from "../domain/finished-fight-page.ts";
import type { RunnedFightPage, RunnedFightRecord } from "../domain/runned-fight-record.ts";

export function paginateRunnedFights(
  rows: readonly RunnedFightRecord[],
  query: FinishedFightListQuery,
): RunnedFightPage {
  if (!query.areaId) throw new Error("Runned fight list requires an area id");
  if (!Number.isInteger(query.page) || query.page < 1) {
    throw new Error("Runned fight list page must be a positive integer");
  }
  const filtered = rows.filter((row) => matchesFilters(row, query));
  const pageCount =
    filtered.length === 0 ? 0 : Math.ceil(filtered.length / FINISHED_FIGHT_PAGE_SIZE);
  const pageIndex = pageCount === 0 ? 0 : Math.min(query.page, pageCount) - 1;
  const start = pageIndex * FINISHED_FIGHT_PAGE_SIZE;
  return {
    pageIndex,
    pageCount,
    totalItems: filtered.length,
    fights: filtered.slice(start, start + FINISHED_FIGHT_PAGE_SIZE),
  };
}

function matchesFilters(row: RunnedFightRecord, query: FinishedFightListQuery): boolean {
  if (query.type !== undefined && row.type !== query.type) return false;
  if (query.levelMin !== undefined && row.levelMax < query.levelMin) return false;
  if (query.levelMax !== undefined && row.levelMin > query.levelMax) return false;
  if (query.nick !== undefined) {
    const needle = query.nick.toLowerCase();
    const names = [...row.teams["1"], ...row.teams["2"]].map((member) => member.nick.toLowerCase());
    if (!names.some((nick) => nick.includes(needle))) return false;
  }
  return true;
}
