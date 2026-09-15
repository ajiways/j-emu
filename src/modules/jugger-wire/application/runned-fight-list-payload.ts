import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type {
  RunnedFightPage,
  RunnedFightRecord,
} from "../../combat/domain/runned-fight-record.ts";

export type RunnedFightListPayload = Readonly<{
  status: 100;
  page: number;
  page_count: number;
  total_items: number;
  fights: readonly RunnedFightWireRow[];
}>;

type RunnedFightWireRow = Readonly<{
  id: number;
  title: string;
  type: number;
  timeout: number;
  level_min: number;
  level_max: number;
  level: number;
  ml_title: string;
  started: string;
  duration: string;
  teams: Readonly<{
    "1": readonly object[];
    "2": readonly object[];
  }>;
}>;

export function runnedFightListPayload(
  page: RunnedFightPage,
  viewerHeroId: number,
): RunnedFightListPayload {
  requireWireIdentity(viewerHeroId, "viewer hero id");
  return {
    status: 100,
    page: page.pageIndex,
    page_count: page.pageCount,
    total_items: page.totalItems,
    fights: page.fights.map((row) => toWireRow(row, viewerHeroId)),
  };
}

function toWireRow(row: RunnedFightRecord, viewerHeroId: number): RunnedFightWireRow {
  return {
    id: requireWireIdentity(Number(row.id), "fight id"),
    title: row.title,
    type: row.type,
    timeout: row.timeout,
    level_min: row.levelMin,
    level_max: row.levelMax,
    level: row.level,
    ml_title: row.mlTitle,
    started: row.started,
    duration: String(row.duration),
    teams: {
      "1": row.teams["1"].map((member) => overlayMe(member, viewerHeroId)),
      "2": row.teams["2"].map((member) => overlayMe(member, viewerHeroId)),
    },
  };
}

function overlayMe(member: RunnedFightRecord["teams"]["1"][number], viewerHeroId: number): object {
  if (member.bot === 1) return member;
  return { ...member, me: member.id === viewerHeroId ? 1 : 0 };
}
