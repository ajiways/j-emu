import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import type { Clock } from "../../shared/kernel/clock.ts";
import { PostgresActiveContentRevision } from "../content/infrastructure/postgres-active-content-revision.ts";
import { QuestService } from "./application/quest-service.ts";
import { PostgresHeroQuestRepository } from "./infrastructure/postgres-hero-quest-repository.ts";
import { PostgresQuestCatalog } from "./infrastructure/postgres-quest-catalog.ts";
import { PostgresQuestProjection } from "./infrastructure/postgres-quest-projection.ts";
import type { QuestCatalog } from "./ports/quest-catalog.ts";
import type { QuestProjection } from "./ports/quest-projection.ts";

export class QuestsModule {
  private constructor(
    readonly service: QuestService,
    readonly catalog: QuestCatalog,
    readonly projection: QuestProjection,
  ) {}

  static create(input: { database: PostgresDatabase; clock: Clock }): QuestsModule {
    const database = requirePresent(input.database, "Quests module requires a database");
    const clock = requirePresent(input.clock, "Quests module requires a clock");
    const revision = new PostgresActiveContentRevision(database);
    const catalog = new PostgresQuestCatalog(database, revision);
    return new QuestsModule(
      new QuestService(catalog, new PostgresHeroQuestRepository(database), clock),
      catalog,
      new PostgresQuestProjection(database),
    );
  }

  async close(): Promise<void> {}
}
