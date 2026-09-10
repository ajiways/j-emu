import type { Listing, NewListing } from "../domain/listing.ts";
import type { ListingKind } from "../domain/listing-kind.ts";
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
  searchTenders(search: ListingSearch, now: Date, unpaged: boolean): Promise<LotSearchPage>;
  listMine(kind: ListingKind, ownerHeroId: number, now: Date): Promise<readonly Listing[]>;
  listMyBids(bidderHeroId: number, now: Date): Promise<readonly Listing[]>;
  minListedUnitGold(artikulId: number, now: Date): Promise<number | null>;
}
