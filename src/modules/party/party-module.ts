import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import type { Clock } from "../../shared/kernel/clock.ts";
import { PartyBagService } from "./application/party-bag-service.ts";
import { PartyJoinService } from "./application/party-join-service.ts";
import { PartyService } from "./application/party-service.ts";
import { PostgresPartyBagRepository } from "./infrastructure/postgres-party-bag-repository.ts";
import { PostgresPartyRepository } from "./infrastructure/postgres-party-repository.ts";

export class PartyModule {
  private constructor(
    readonly service: PartyService,
    readonly join: PartyJoinService,
    readonly bag: PartyBagService,
  ) {}

  static create(input: { database: PostgresDatabase; clock: Clock }): PartyModule {
    const database = requirePresent(input.database, "Party module requires a database");
    const clock = requirePresent(input.clock, "Party module requires a clock");
    const parties = new PostgresPartyRepository(database);
    const service = new PartyService(parties, database, clock);
    const bag = new PartyBagService(
      parties,
      new PostgresPartyBagRepository(database),
      database,
      clock,
    );
    return new PartyModule(service, new PartyJoinService(service), bag);
  }

  async close(): Promise<void> {}
}
