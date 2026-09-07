import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { ActiveContentRevision } from "../ports/active-content-revision.ts";
import { activeRelease } from "./schema.ts";

export class PostgresActiveContentRevision implements ActiveContentRevision {
  constructor(private readonly database: PostgresDatabase) {}

  async requireId(): Promise<string> {
    const rows = await this.database.session().select().from(activeRelease);
    if (rows.length !== 1) {
      throw new Error("content.active_release singleton is missing");
    }
    const releaseId = rows[0]?.releaseId;
    if (!releaseId) throw new Error("No published content revision");
    return releaseId;
  }
}
