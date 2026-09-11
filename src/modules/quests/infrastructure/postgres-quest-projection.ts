import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { QuestProjection, QuestMaterialization } from "../ports/quest-projection.ts";
import { insertQuestDocuments } from "./postgres-quest-rows.ts";

export class PostgresQuestProjection implements QuestProjection {
  constructor(private readonly database: PostgresDatabase) {}

  async materialize(releaseId: string, documents: QuestMaterialization): Promise<void> {
    if (!releaseId) throw new Error("Quest release id is required");
    await insertQuestDocuments(
      this.database.session(),
      releaseId,
      documents.npcs,
      documents.quests,
      documents.worldFacts,
    );
  }
}
