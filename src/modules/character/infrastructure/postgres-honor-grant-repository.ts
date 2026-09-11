import { and, eq, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { HonorGrantRepository, PersistedHonorGrant } from "../ports/honor-grant-repository.ts";
import { honorGrants } from "./schema.ts";

export class PostgresHonorGrantRepository implements HonorGrantRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async find(heroId: number, operationId: string): Promise<PersistedHonorGrant | null> {
    const rows = await this.database
      .session()
      .select()
      .from(honorGrants)
      .where(and(eq(honorGrants.heroId, heroId), eq(honorGrants.operationId, operationId)));
    if (rows.length > 1) {
      throw new Error(`Multiple honor grants found for hero ${heroId} ${operationId}`);
    }
    const row = rows[0];
    if (!row) return null;
    return {
      heroId: row.heroId,
      operationId: row.operationId,
      amount: row.amount,
      honorBefore: row.honorBefore,
      honorAfter: row.honorAfter,
      added: row.honorAfter - row.honorBefore,
      rank: row.rank,
      honorMin: row.honorMin,
      honorMax: row.honorMax,
      honorStatus: row.honorStatus,
      contentReleaseId: row.contentReleaseId,
    };
  }

  async insert(grant: PersistedHonorGrant): Promise<void> {
    const inserted = await this.database
      .session()
      .insert(honorGrants)
      .values({
        heroId: grant.heroId,
        operationId: grant.operationId,
        amount: grant.amount,
        honorBefore: grant.honorBefore,
        honorAfter: grant.honorAfter,
        rank: grant.rank,
        honorMin: grant.honorMin,
        honorMax: grant.honorMax,
        honorStatus: grant.honorStatus,
        contentReleaseId: grant.contentReleaseId,
        createdAt: sql`now()`,
      })
      .returning({ heroId: honorGrants.heroId });
    if (inserted.length !== 1) {
      throw new Error(`Honor grant ${grant.operationId} was not inserted`);
    }
  }
}
