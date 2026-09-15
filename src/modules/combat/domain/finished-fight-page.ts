import type { FinishedFightRecord } from "../domain/finished-fight-record.ts";

export type FinishedFightListQuery = Readonly<{
  areaId: string;
  page: number;
  nick?: string;
  type?: number;
  levelMin?: number;
  levelMax?: number;
}>;

export type FinishedFightPage = Readonly<{
  pageIndex: number;
  pageCount: number;
  totalItems: number;
  fights: readonly FinishedFightRecord[];
}>;
