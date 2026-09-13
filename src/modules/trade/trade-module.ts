import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import { TradeSessions } from "./application/trade-sessions.ts";
import { PostgresHeldItemsRepository } from "./infrastructure/postgres-held-items-repository.ts";
import type { HeldItemsRepository } from "./ports/held-items-repository.ts";

export class TradeModule {
  private constructor(
    readonly sessions: TradeSessions,
    readonly heldItems: HeldItemsRepository,
  ) {}

  static create(input: { database: PostgresDatabase }): TradeModule {
    const database = requirePresent(input.database, "Trade module requires a database");
    return new TradeModule(new TradeSessions(), new PostgresHeldItemsRepository(database));
  }

  async close(): Promise<void> {}
}
