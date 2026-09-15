import type { Clock } from "../../../shared/kernel/clock.ts";
import {
  FINISHED_FIGHT_PAGE_SIZE,
  FINISHED_FIGHT_RETENTION_MS,
} from "../domain/finished-fight-retention.ts";
import type { FinishedFightListQuery, FinishedFightPage } from "../domain/finished-fight-page.ts";
import type { FinishedFightRecord } from "../domain/finished-fight-record.ts";
import type { FinishedFightStore } from "../ports/finished-fight-store.ts";

export class FinishedFightList {
  constructor(
    private readonly store: FinishedFightStore,
    private readonly clock: Clock,
  ) {}

  async list(query: FinishedFightListQuery): Promise<FinishedFightPage> {
    if (!query.areaId) throw new Error("Finished fight list requires an area id");
    if (!Number.isInteger(query.page) || query.page < 1) {
      throw new Error("Finished fight list page must be a positive integer");
    }
    const cutoff = new Date(this.clock.now().getTime() - FINISHED_FIGHT_RETENTION_MS);
    const filtered = (await this.store.listByArea(query.areaId, cutoff)).filter((row) =>
      matchesFilters(row, query),
    );
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

  async card(id: bigint): Promise<FinishedFightRecord | null> {
    const row = await this.store.findById(id);
    if (!row) return null;
    const cutoff = new Date(this.clock.now().getTime() - FINISHED_FIGHT_RETENTION_MS);
    if (row.finishedAt.getTime() <= cutoff.getTime()) return null;
    return row;
  }
}

function matchesFilters(row: FinishedFightRecord, query: FinishedFightListQuery): boolean {
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
