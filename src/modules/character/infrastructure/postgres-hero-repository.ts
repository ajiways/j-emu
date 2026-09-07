import { eq, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { Hero, type HeroCreationPolicy } from "../domain/hero.ts";
import type { HeroRepository } from "../ports/hero-repository.ts";
import { heroes } from "./schema.ts";

export class PostgresHeroRepository implements HeroRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async findById(id: string): Promise<Hero | null> {
    const rows = await this.database.session().select().from(heroes).where(eq(heroes.id, id));
    return this.single(rows, `hero id ${id}`);
  }

  async findByAccountId(accountId: string): Promise<Hero | null> {
    const rows = await this.database
      .session()
      .select()
      .from(heroes)
      .where(eq(heroes.accountId, accountId));
    return this.single(rows, `hero account ${accountId}`);
  }

  async create(accountId: string, nick: string, policy: HeroCreationPolicy): Promise<Hero> {
    Hero.assertCreationPolicy(policy);
    const rows = await this.database
      .session()
      .insert(heroes)
      .values({
        accountId,
        nick,
        level: policy.level,
        hp: policy.hp,
        maxHp: policy.maxHp,
        areaId: policy.areaId,
        moneyMinor: BigInt(policy.moneyMinor),
        version: 1,
      })
      .returning();
    const hero = this.single(rows, `created hero for account ${accountId}`);
    if (!hero) throw new Error("Hero insert did not return an id");
    return hero;
  }

  async save(hero: Hero): Promise<void> {
    await this.database
      .session()
      .insert(heroes)
      .values({
        id: hero.id,
        accountId: hero.accountId,
        nick: hero.nick,
        level: hero.level,
        hp: hero.hp,
        maxHp: hero.maxHp,
        areaId: hero.areaId,
        moneyMinor: BigInt(hero.moneyMinor),
        version: 1,
      })
      .onConflictDoUpdate({
        target: heroes.id,
        set: {
          level: hero.level,
          hp: hero.hp,
          maxHp: hero.maxHp,
          areaId: hero.areaId,
          moneyMinor: BigInt(hero.moneyMinor),
          version: sql`${heroes.version} + 1`,
        },
      });
  }

  private single(
    rows: Array<{
      id: string;
      accountId: string;
      nick: string;
      level: number;
      hp: number;
      maxHp: number;
      areaId: string;
      moneyMinor: bigint;
    }>,
    key: string,
  ): Hero | null {
    if (rows.length > 1) throw new Error(`Multiple rows found for ${key}`);
    const row = rows[0];
    if (!row) return null;
    const moneyMinor = Number(row.moneyMinor);
    if (!Number.isSafeInteger(moneyMinor)) throw new Error(`Unsafe money value for ${key}`);
    return Hero.restore({
      id: row.id,
      accountId: row.accountId,
      nick: row.nick,
      level: row.level,
      hp: row.hp,
      maxHp: row.maxHp,
      areaId: row.areaId,
      moneyMinor,
    });
  }
}
