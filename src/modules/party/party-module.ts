import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import type { Clock } from "../../shared/kernel/clock.ts";
import { PartyJoinService } from "./application/party-join-service.ts";
import { PartyService } from "./application/party-service.ts";
import { PostgresPartyRepository } from "./infrastructure/postgres-party-repository.ts";

export class PartyModule {
  private constructor(
    readonly service: PartyService,
    readonly join: PartyJoinService,
  ) {}

  static create(input: { database: PostgresDatabase; clock: Clock }): PartyModule {
    const database = requirePresent(input.database, "Party module requires a database");
    const clock = requirePresent(input.clock, "Party module requires a clock");
    const service = new PartyService(new PostgresPartyRepository(database), database, clock);
    return new PartyModule(service, new PartyJoinService(service));
  }

  async close(): Promise<void> {}
}
