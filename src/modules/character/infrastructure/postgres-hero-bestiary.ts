import { eq, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { HeroBestiary, HeroBotWin } from "../ports/hero-bestiary.ts";
import { heroBotKills } from "./schema.ts";

export class PostgresHeroBestiary implements HeroBestiary {
  constructor(private readonly database: PostgresDatabase) {}

  async noteWin(heroId: number, botId: number): Promise<void> {
    requirePositiveId(heroId, "hero id");
    requirePositiveId(botId, "bot id");
    await this.database
      .session()
      .insert(heroBotKills)
      .values({ heroId, botId, winCnt: 1 })
      .onConflictDoUpdate({
        target: [heroBotKills.heroId, heroBotKills.botId],
        set: { winCnt: sql`${heroBotKills.winCnt} + 1` },
      });
  }

  async listWins(heroId: number): Promise<readonly HeroBotWin[]> {
    requirePositiveId(heroId, "hero id");
    const rows = await this.database
      .session()
      .select({ botId: heroBotKills.botId, winCnt: heroBotKills.winCnt })
      .from(heroBotKills)
      .where(eq(heroBotKills.heroId, heroId));
    return rows.map((row) => {
      if (!Number.isInteger(row.winCnt) || row.winCnt < 1) {
        throw new Error(`Bestiary win_cnt for hero ${heroId} bot ${row.botId} is missing`);
      }
      return { botId: row.botId, winCnt: row.winCnt };
    });
  }
}

function requirePositiveId(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
}
