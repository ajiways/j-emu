import { and, eq, gt, lte, or } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { HeroAssistant, HeroAssistantInsert } from "../domain/hero-assistant.ts";
import type { HeroAssistantRepository } from "../ports/hero-assistant-repository.ts";
import { heroAssistants } from "./schema.ts";

export class PostgresHeroAssistantRepository implements HeroAssistantRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async listByHero(heroId: number): Promise<HeroAssistant[]> {
    const rows = await this.database
      .session()
      .select()
      .from(heroAssistants)
      .where(eq(heroAssistants.heroId, heroId));
    return rows.map(toAssistant);
  }

  async findById(heroId: number, id: number): Promise<HeroAssistant | null> {
    const rows = await this.database
      .session()
      .select()
      .from(heroAssistants)
      .where(and(eq(heroAssistants.id, id), eq(heroAssistants.heroId, heroId)));
    if (rows.length > 1) throw new Error(`Multiple assistants found for ${id}`);
    const row = rows[0];
    return row ? toAssistant(row) : null;
  }

  async insert(row: HeroAssistantInsert): Promise<HeroAssistant> {
    const inserted = await this.database.session().insert(heroAssistants).values(row).returning();
    const created = inserted[0];
    if (!created) throw new Error("Assistant insert did not return a row");
    return toAssistant(created);
  }

  async save(row: HeroAssistant): Promise<void> {
    await this.database
      .session()
      .update(heroAssistants)
      .set({
        artikulId: row.artikulId,
        nick: row.nick,
        skillSpeed: row.skillSpeed,
        skillDefence: row.skillDefence,
        skillIntellect: row.skillIntellect,
        tactics: row.tactics,
        farmId: row.farmId,
        areaId: row.areaId,
        ftime: row.ftime,
        stime: row.stime,
        attackAt: row.attackAt,
        stamina: row.stamina,
        staminaResetTime: row.staminaResetTime,
        masteryValue: row.masteryValue,
        resultType: row.resultType,
        resultValue: row.resultValue,
        flags: row.flags,
        cycleResult: row.cycleResult,
        lootGranted: row.lootGranted,
      })
      .where(eq(heroAssistants.id, row.id));
  }

  async delete(id: number): Promise<void> {
    await this.database.session().delete(heroAssistants).where(eq(heroAssistants.id, id));
  }

  async listDue(nowSec: number): Promise<HeroAssistant[]> {
    const rows = await this.database
      .session()
      .select()
      .from(heroAssistants)
      .where(
        and(
          eq(heroAssistants.cycleResult, ""),
          or(
            and(gt(heroAssistants.ftime, 0), lte(heroAssistants.ftime, nowSec)),
            and(gt(heroAssistants.attackAt, 0), lte(heroAssistants.attackAt, nowSec)),
          ),
        ),
      );
    return rows.map(toAssistant);
  }
}

function toAssistant(row: typeof heroAssistants.$inferSelect): HeroAssistant {
  return {
    id: row.id,
    heroId: row.heroId,
    artikulId: row.artikulId,
    nick: row.nick,
    skillSpeed: row.skillSpeed,
    skillDefence: row.skillDefence,
    skillIntellect: row.skillIntellect,
    tactics: row.tactics,
    farmId: row.farmId,
    areaId: row.areaId,
    ftime: row.ftime,
    stime: row.stime,
    attackAt: row.attackAt,
    stamina: row.stamina,
    staminaResetTime: row.staminaResetTime,
    masteryValue: row.masteryValue,
    resultType: row.resultType,
    resultValue: row.resultValue,
    flags: row.flags,
    cycleResult: row.cycleResult,
    lootGranted: row.lootGranted,
  };
}
