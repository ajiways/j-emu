import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import type { Clock } from "../../shared/kernel/clock.ts";
import { MailService } from "./application/mail-service.ts";
import { PostgresLetterRepository } from "./infrastructure/postgres-letter-repository.ts";

export class MailModule {
  private constructor(readonly service: MailService) {}

  static create(input: {
    database: PostgresDatabase;
    clock: Clock;
    heroes: Readonly<{
      getById(id: number): Promise<{ id: number; nick: string } | null>;
    }>;
  }): MailModule {
    const database = requirePresent(input.database, "Mail module requires a database");
    const clock = requirePresent(input.clock, "Mail module requires a clock");
    const heroes = requirePresent(input.heroes, "Mail module requires hero lookup");
    return new MailModule(
      new MailService(new PostgresLetterRepository(database), clock, database, heroes),
    );
  }

  async close(): Promise<void> {}
}
