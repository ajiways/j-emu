import { and, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { ActiveContentRevision } from "../../content/ports/active-content-revision.ts";
import { ArtifactDefinition } from "../domain/artifact-definition.ts";
import { BotDefinition } from "../domain/bot-definition.ts";
import type { Catalog } from "../ports/catalog.ts";
import { artifacts, bots } from "./schema.ts";

export class PostgresCatalog implements Catalog {
  constructor(
    private readonly database: PostgresDatabase,
    private readonly revision: ActiveContentRevision,
  ) {}

  async artifact(id: number): Promise<ArtifactDefinition | null> {
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(artifacts)
      .where(and(eq(artifacts.releaseId, releaseId), eq(artifacts.id, id)));
    if (rows.length > 1) throw new Error(`Multiple artifact definitions found for ${id}`);
    const row = rows[0];
    return row
      ? new ArtifactDefinition(
          row.id,
          row.title,
          row.picture,
          row.typeId,
          row.kindId,
          row.slotMask,
          row.weight,
        )
      : null;
  }

  async bot(id: number): Promise<BotDefinition | null> {
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(bots)
      .where(and(eq(bots.releaseId, releaseId), eq(bots.id, id)));
    if (rows.length > 1) throw new Error(`Multiple bot definitions found for ${id}`);
    const row = rows[0];
    return row ? new BotDefinition(row.id, row.title, row.level, row.maxHp, row.strength) : null;
  }
}
