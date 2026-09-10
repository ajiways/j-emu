import type { Clock } from "../../../shared/kernel/clock.ts";
import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { AuctionDeniedError } from "../domain/auction-denied-error.ts";
import { moneyRound } from "../domain/listing-tax.ts";
import type { Listing, NewListing } from "../domain/listing.ts";
import type { ListingSearch } from "../domain/listing-search.ts";
import type { ListingRepository } from "../ports/listing-repository.ts";

export class AuctionService {
  constructor(
    private readonly listings: ListingRepository,
    private readonly clock: Clock,
  ) {}

  now(): Date {
    return this.clock.now();
  }

  async searchLots(search: ListingSearch): Promise<{
    rows: readonly Listing[];
    total: number;
    offset: number;
  }> {
    return this.listings.searchLots(search, this.clock.now());
  }

  async listMine(heroId: number): Promise<readonly Listing[]> {
    requireWireIdentity(heroId, "hero id");
    return this.listings.listMine(heroId, this.clock.now());
  }

  async listMyBids(heroId: number): Promise<readonly Listing[]> {
    requireWireIdentity(heroId, "hero id");
    return this.listings.listMyBids(heroId, this.clock.now());
  }

  async minPriceGold(artikulId: number, amount: number): Promise<number> {
    requireWireIdentity(artikulId, "artikul id");
    if (!Number.isInteger(amount) || amount < 1) {
      throw new AuctionDeniedError("Таких лотов нет.");
    }
    const unitGold = await this.listings.minListedUnitGold(artikulId, this.clock.now());
    if (unitGold === null) throw new AuctionDeniedError("Таких лотов нет.");
    const buyout = moneyRound(unitGold * amount);
    if (buyout <= 0) throw new AuctionDeniedError("Таких лотов нет.");
    return buyout;
  }

  async insert(row: NewListing): Promise<Listing> {
    return this.listings.insert(row);
  }

  async lock(id: number): Promise<Listing | null> {
    requireWireIdentity(id, "lot id");
    return this.listings.lock(id);
  }

  async lockExpired(): Promise<readonly Listing[]> {
    return this.listings.lockExpired(this.clock.now());
  }

  async save(listing: Listing): Promise<void> {
    await this.listings.save(listing);
  }
}
