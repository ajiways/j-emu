import type { Listing, NewListing } from "../domain/listing.ts";
import type { ListingSearch } from "../domain/listing-search.ts";

export type LotSearchPage = Readonly<{
  rows: readonly Listing[];
  total: number;
  offset: number;
}>;

export interface ListingRepository {
  insert(row: NewListing): Promise<Listing>;
  lock(id: number): Promise<Listing | null>;
  lockExpired(now: Date): Promise<readonly Listing[]>;
  save(listing: Listing): Promise<void>;
  searchLots(search: ListingSearch, now: Date): Promise<LotSearchPage>;
  listMine(ownerHeroId: number, now: Date): Promise<readonly Listing[]>;
  listMyBids(bidderHeroId: number, now: Date): Promise<readonly Listing[]>;
  minListedUnitGold(artikulId: number, now: Date): Promise<number | null>;
}
