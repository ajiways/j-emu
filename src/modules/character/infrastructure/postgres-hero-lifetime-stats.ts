import { eq, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type {
  FightCounterDelta,
  HeroLifetimeCounters,
  HeroLifetimeStats,
} from "../ports/hero-lifetime-stats.ts";
import { heroLifetimeStats } from "./schema.ts";

export class PostgresHeroLifetimeStats implements HeroLifetimeStats {
  constructor(private readonly database: PostgresDatabase) {}

  async applyFight(delta: FightCounterDelta): Promise<void> {
    for (const [name, value] of Object.entries(delta)) {
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`Fight counter ${name} must be a non-negative integer`);
      }
    }
    const table = heroLifetimeStats;
    // An UPSERT keeps the largest damage of a fight (GREATEST) and starts the daily kills again
    // when the row belongs to an earlier cycle, which Drizzle's plain updates cannot express.
    await this.database
      .session()
      .insert(table)
      .values({
        heroId: delta.characterId,
        wins: delta.wins,
        losses: delta.losses,
        duelWins: delta.duelWins,
        maxFightDamage: delta.fightDamage,
        fatalities: delta.fatalities,
        pvpKills: delta.pvpKills,
        dailyPvpKills: delta.pvpKills,
        dailyCycleStart: delta.dailyCycleStart,
      })
      .onConflictDoUpdate({
        target: table.heroId,
        set: {
          wins: sql`${table.wins} + ${delta.wins}`,
          losses: sql`${table.losses} + ${delta.losses}`,
          duelWins: sql`${table.duelWins} + ${delta.duelWins}`,
          maxFightDamage: sql`GREATEST(${table.maxFightDamage}, ${delta.fightDamage})`,
          fatalities: sql`${table.fatalities} + ${delta.fatalities}`,
          pvpKills: sql`${table.pvpKills} + ${delta.pvpKills}`,
          dailyPvpKills: sql`CASE WHEN ${table.dailyCycleStart} < ${delta.dailyCycleStart}
            THEN ${delta.pvpKills} ELSE ${table.dailyPvpKills} + ${delta.pvpKills} END`,
          dailyCycleStart: sql`GREATEST(${table.dailyCycleStart}, ${delta.dailyCycleStart})`,
        },
      });
  }

  async fatalityCount(characterId: number): Promise<number> {
    const rows = await this.database
      .session()
      .select({ fatalities: heroLifetimeStats.fatalities })
      .from(heroLifetimeStats)
      .where(eq(heroLifetimeStats.heroId, characterId));
    // No row: the hero has not finished a fight, so he has executed no one.
    return rows[0]?.fatalities ?? 0;
  }

  async read(characterId: number, dailyCycleStart: number): Promise<HeroLifetimeCounters> {
    const rows = await this.database
      .session()
      .select()
      .from(heroLifetimeStats)
      .where(eq(heroLifetimeStats.heroId, characterId));
    const row = rows[0];
    // No row: the hero has not finished a fight, every counter is zero.
    if (!row) {
      return {
        wins: 0,
        losses: 0,
        duelWins: 0,
        maxFightDamage: 0,
        fatalities: 0,
        pvpKills: 0,
        dailyPvpKills: 0,
      };
    }
    return {
      wins: row.wins,
      losses: row.losses,
      duelWins: row.duelWins,
      maxFightDamage: row.maxFightDamage,
      fatalities: row.fatalities,
      pvpKills: row.pvpKills,
      dailyPvpKills: row.dailyCycleStart < dailyCycleStart ? 0 : row.dailyPvpKills,
    };
  }
}
