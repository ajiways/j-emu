import { and, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { HeroLearnedBonusRepository } from "../ports/hero-learned-bonus-repository.ts";
import { heroLearnedBonuses } from "./schema.ts";

export class PostgresHeroLearnedBonusRepository implements HeroLearnedBonusRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async has(heroId: number, bonusId: number): Promise<boolean> {
    const rows = await this.database
      .session()
      .select({ bonusId: heroLearnedBonuses.bonusId })
      .from(heroLearnedBonuses)
      .where(and(eq(heroLearnedBonuses.heroId, heroId), eq(heroLearnedBonuses.bonusId, bonusId)));
    if (rows.length > 1) {
      throw new Error(`Multiple learned bonus rows for hero ${heroId} bonus ${bonusId}`);
    }
    return rows.length === 1;
  }

  async insert(heroId: number, bonusId: number, artikulId: number): Promise<void> {
    if (!Number.isInteger(artikulId) || artikulId < 1) {
      throw new Error("Learned bonus artikulId is required");
    }
    await this.database.session().insert(heroLearnedBonuses).values({ heroId, bonusId, artikulId });
  }
}
