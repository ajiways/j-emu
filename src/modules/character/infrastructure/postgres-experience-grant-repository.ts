import { and, eq, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type {
  ExperienceGrantRepository,
  PersistedExperienceGrant,
} from "../ports/experience-grant-repository.ts";
import { experienceGrants } from "./schema.ts";

export class PostgresExperienceGrantRepository implements ExperienceGrantRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async find(heroId: number, operationId: string): Promise<PersistedExperienceGrant | null> {
    const rows = await this.database
      .session()
      .select()
      .from(experienceGrants)
      .where(
        and(eq(experienceGrants.heroId, heroId), eq(experienceGrants.operationId, operationId)),
      );
    if (rows.length > 1) {
      throw new Error(`Multiple experience grants found for hero ${heroId} ${operationId}`);
    }
    const row = rows[0];
    if (!row) return null;
    return {
      heroId: row.heroId,
      operationId: row.operationId,
      amount: row.amount,
      expBefore: row.expBefore,
      expAfter: row.expAfter,
      levelBefore: row.levelBefore,
      levelAfter: row.levelAfter,
      levelsGained: row.levelAfter - row.levelBefore,
      contentReleaseId: row.contentReleaseId,
      progressionDigest: row.progressionDigest,
    };
  }

  async insert(grant: PersistedExperienceGrant): Promise<void> {
    const inserted = await this.database
      .session()
      .insert(experienceGrants)
      .values({
        heroId: grant.heroId,
        operationId: grant.operationId,
        amount: grant.amount,
        expBefore: grant.expBefore,
        expAfter: grant.expAfter,
        levelBefore: grant.levelBefore,
        levelAfter: grant.levelAfter,
        contentReleaseId: grant.contentReleaseId,
        progressionDigest: grant.progressionDigest,
        createdAt: sql`now()`,
      })
      .returning({ heroId: experienceGrants.heroId });
    if (inserted.length !== 1) {
      throw new Error(`Experience grant ${grant.operationId} was not inserted`);
    }
  }
}
