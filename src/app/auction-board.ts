import type { AuctionService } from "../modules/auction/application/auction-service.ts";
import type { Listing } from "../modules/auction/domain/listing.ts";
import type { ListingSearch } from "../modules/auction/domain/listing-search.ts";
import type { AuctionExpiry } from "./auction-expiry.ts";

export class AuctionBoard {
  constructor(
    private readonly expiry: AuctionExpiry,
    private readonly auction: Pick<
      AuctionService,
      "searchLots" | "listMine" | "listMyBids" | "minPriceGold"
    >,
  ) {}

  lots(
    search: ListingSearch,
  ): Promise<{ rows: readonly Listing[]; total: number; offset: number }> {
    return this.expiry.withSweep(() => this.auction.searchLots(search));
  }

  myLot(heroId: number): Promise<readonly Listing[]> {
    return this.expiry.withSweep(() => this.auction.listMine(heroId));
  }

  myBid(heroId: number): Promise<readonly Listing[]> {
    return this.expiry.withSweep(() => this.auction.listMyBids(heroId));
  }

  minPrice(artikulId: number, amount: number): Promise<number> {
    return this.expiry.withSweep(() => this.auction.minPriceGold(artikulId, amount));
  }
}
