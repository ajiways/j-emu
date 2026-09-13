import type { TradeItemSnapshot } from "../domain/trade-session.ts";

export type HeldItemRecord = Readonly<{
  id: number;
  heroId: number;
}> &
  TradeItemSnapshot;

export interface HeldItemsRepository {
  upsertAdd(heroId: number, snapshot: TradeItemSnapshot): Promise<void>;
  lock(heroId: number, originalItemId: number): Promise<HeldItemRecord>;
  decrease(heroId: number, originalItemId: number, quantity: number): Promise<void>;
  deleteForHeroes(heroIds: readonly number[]): Promise<void>;
  listAll(): Promise<readonly HeldItemRecord[]>;
  deleteById(id: number): Promise<void>;
}
