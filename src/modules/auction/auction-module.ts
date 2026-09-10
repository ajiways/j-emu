import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import type { Clock } from "../../shared/kernel/clock.ts";
import { AuctionService } from "./application/auction-service.ts";
import { PostgresListingRepository } from "./infrastructure/postgres-listing-repository.ts";

export class AuctionModule {
  private constructor(readonly service: AuctionService) {}

  static create(input: { database: PostgresDatabase; clock: Clock }): AuctionModule {
    const database = requirePresent(input.database, "Auction module requires a database");
    const clock = requirePresent(input.clock, "Auction module requires a clock");
    return new AuctionModule(new AuctionService(new PostgresListingRepository(database), clock));
  }

  async close(): Promise<void> {}
}
