import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import { SystemClock } from "../../shared/kernel/system-clock.ts";
import { IdentityService } from "./application/identity-service.ts";
import { PasswordHasher } from "./domain/password-hasher.ts";
import { PostgresAccountRepository } from "./infrastructure/postgres-account-repository.ts";
import { PostgresSessionRepository } from "./infrastructure/postgres-session-repository.ts";

export class IdentityModule {
  private constructor(readonly service: IdentityService) {}

  static create(input: { database: PostgresDatabase }): IdentityModule {
    const database = requirePresent(input.database, "Identity module requires a database");
    return new IdentityModule(
      new IdentityService(
        new PostgresAccountRepository(database),
        new PostgresSessionRepository(database),
        database,
        new SystemClock(),
        new PasswordHasher(),
      ),
    );
  }

  async close(): Promise<void> {}
}
