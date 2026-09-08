import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import type { Clock } from "../../shared/kernel/clock.ts";
import { IdentityService } from "./application/identity-service.ts";
import { PasswordHasher } from "./domain/password-hasher.ts";
import { PostgresAccountRepository } from "./infrastructure/postgres-account-repository.ts";
import { PostgresSessionRepository } from "./infrastructure/postgres-session-repository.ts";

export class IdentityModule {
  private constructor(readonly service: IdentityService) {}

  static create(input: { database: PostgresDatabase; clock: Clock }): IdentityModule {
    const database = requirePresent(input.database, "Identity module requires a database");
    const clock = requirePresent(input.clock, "Identity module requires a clock");
    return new IdentityModule(
      new IdentityService(
        new PostgresAccountRepository(database),
        new PostgresSessionRepository(database),
        database,
        clock,
        new PasswordHasher(),
      ),
    );
  }

  async close(): Promise<void> {}
}
