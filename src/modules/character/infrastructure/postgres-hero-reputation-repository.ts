import { asc, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type {
  HeroReputationRepository,
  HeroReputationValue,
} from "../ports/hero-reputation-repository.ts";
import { heroReputations } from "./schema.ts";

export class PostgresHeroReputationRepository implements HeroReputationRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async listByHeroId(heroId: number): Promise<readonly HeroReputationValue[]> {
    if (!Number.isInteger(heroId) || heroId < 1) throw new Error("Hero id is required");
    const rows = await this.database
      .session()
      .select()
      .from(heroReputations)
      .where(eq(heroReputations.heroId, heroId))
      .orderBy(asc(heroReputations.objectId));
    return rows.map((row) => ({ objectId: row.objectId, value: row.value }));
  }

  async upsert(heroId: number, objectId: number, value: number): Promise<void> {
    if (!Number.isInteger(heroId) || heroId < 1) throw new Error("Hero id is required");
    if (!Number.isInteger(objectId) || objectId < 1) {
      throw new Error("Reputation object id is required");
    }
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("Reputation value must be a non-negative integer");
    }
    await this.database
      .session()
      .insert(heroReputations)
      .values({ heroId, objectId, value })
      .onConflictDoUpdate({
        target: [heroReputations.heroId, heroReputations.objectId],
        set: { value },
      });
  }
}
