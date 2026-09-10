import type { InventoryItem } from "../modules/inventory/domain/inventory-item.ts";
import type { AuctionService } from "../modules/auction/application/auction-service.ts";
import { LISTING_KIND_LOT, LISTING_KIND_TENDER } from "../modules/auction/domain/listing-kind.ts";
import { bagItemMatchesOrder } from "../modules/auction/domain/listing-match.ts";
import type { Listing } from "../modules/auction/domain/listing.ts";
import type { ListingSearch } from "../modules/auction/domain/listing-search.ts";
import { LOT_PAGE_SIZE } from "../modules/auction/domain/auction-ttl.ts";
import type { AuctionExpiry } from "./auction-expiry.ts";

export class AuctionBoard {
  constructor(
    private readonly expiry: AuctionExpiry,
    private readonly auction: Pick<
      AuctionService,
      "searchLots" | "searchTenders" | "listMine" | "listMyBids" | "minPriceGold"
    >,
  ) {}

  lots(
    search: ListingSearch,
  ): Promise<{ rows: readonly Listing[]; total: number; offset: number }> {
    return this.expiry.withSweep(() => this.auction.searchLots(search));
  }

  tenders(
    search: ListingSearch,
    available: boolean,
    bag: readonly InventoryItem[],
  ): Promise<{ rows: readonly Listing[]; total: number; offset: number }> {
    return this.expiry.withSweep(async () => {
      if (!available) return this.auction.searchTenders(search, false);
      const scanned = await this.auction.searchTenders(search, true);
      const matched = scanned.rows.filter((row) =>
        bag.some((item) => bagItemMatchesOrder(item, row)),
      );
      const offset = search.offset;
      return {
        rows: matched.slice(offset, offset + LOT_PAGE_SIZE),
        total: matched.length,
        offset,
      };
    });
  }

  myLot(heroId: number): Promise<readonly Listing[]> {
    return this.expiry.withSweep(() => this.auction.listMine(heroId, LISTING_KIND_LOT));
  }

  myTenders(heroId: number): Promise<readonly Listing[]> {
    return this.expiry.withSweep(() => this.auction.listMine(heroId, LISTING_KIND_TENDER));
  }

  myBid(heroId: number): Promise<readonly Listing[]> {
    return this.expiry.withSweep(() => this.auction.listMyBids(heroId));
  }

  minPrice(artikulId: number, amount: number): Promise<number> {
    return this.expiry.withSweep(() => this.auction.minPriceGold(artikulId, amount));
  }
}
