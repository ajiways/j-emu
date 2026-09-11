import { eq, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { HeroFarmStat } from "../domain/hero-assistant.ts";
import type { HeroFarmStatRepository } from "../ports/hero-farm-stat-repository.ts";
import { heroFarmStats } from "./schema.ts";

export class PostgresHeroFarmStatRepository implements HeroFarmStatRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async bump(heroId: number, farmId: number): Promise<void> {
    await this.database
      .session()
      .insert(heroFarmStats)
      .values({ heroId, farmId, value: 1 })
      .onConflictDoUpdate({
        target: [heroFarmStats.heroId, heroFarmStats.farmId],
        set: { value: sql`${heroFarmStats.value} + 1` },
      });
  }

  async listByHero(heroId: number): Promise<readonly HeroFarmStat[]> {
    const rows = await this.database
      .session()
      .select()
      .from(heroFarmStats)
      .where(eq(heroFarmStats.heroId, heroId));
    return rows.map((row) => ({ farmId: row.farmId, value: row.value }));
  }
}
