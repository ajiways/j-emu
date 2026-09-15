import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { FinishedFightPage } from "../../combat/domain/finished-fight-page.ts";
import type { FinishedFightRecord } from "../../combat/domain/finished-fight-record.ts";

export type FinishedFightListPayload = Readonly<{
  status: 100;
  page: number;
  page_count: number;
  total_items: number;
  fights: readonly FinishedFightWireRow[];
}>;

type FinishedFightWireRow = Readonly<{
  id: number;
  title: string;
  type: number;
  timeout: number;
  level_min: number;
  level_max: number;
  level: number;
  ml_title: string;
  winner: string;
  started: string;
  duration: string;
  teams: Readonly<{
    "1": readonly object[];
    "2": readonly object[];
  }>;
}>;

export function finishedFightListPayload(
  page: FinishedFightPage,
  viewerHeroId: number,
): FinishedFightListPayload {
  requireWireIdentity(viewerHeroId, "viewer hero id");
  return {
    status: 100,
    page: page.pageIndex,
    page_count: page.pageCount,
    total_items: page.totalItems,
    fights: page.fights.map((row) => toWireRow(row, viewerHeroId)),
  };
}

function toWireRow(row: FinishedFightRecord, viewerHeroId: number): FinishedFightWireRow {
  return {
    id: requireWireIdentity(Number(row.id), "fight id"),
    title: row.title,
    type: row.type,
    timeout: row.timeout,
    level_min: row.levelMin,
    level_max: row.levelMax,
    level: row.level,
    ml_title: row.mlTitle,
    winner: String(row.winner),
    started: row.started,
    duration: String(row.duration),
    teams: {
      "1": row.teams["1"].map((member) => ({
        ...member,
        me: member.id === viewerHeroId ? 1 : 0,
      })),
      "2": row.teams["2"].map((member) =>
        member.bot === 1 ? member : { ...member, me: member.id === viewerHeroId ? 1 : 0 },
      ),
    },
  };
}
