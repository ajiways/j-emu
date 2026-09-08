import { eq, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { Hero, type HeroCreationPolicy, type HeroRecord } from "../domain/hero.ts";
import type { HeroRepository } from "../ports/hero-repository.ts";
import { heroes } from "./schema.ts";

export class PostgresHeroRepository implements HeroRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async findById(id: number): Promise<Hero | null> {
    const rows = await this.database.session().select().from(heroes).where(eq(heroes.id, id));
    return this.single(rows, `hero id ${id}`);
  }

  async findByAccountId(accountId: number): Promise<Hero | null> {
    return this.loadByAccountId(accountId, false);
  }

  async lockByAccountId(accountId: number): Promise<Hero | null> {
    return this.loadByAccountId(accountId, true);
  }

  async create(accountId: number, nick: string, policy: HeroCreationPolicy): Promise<Hero> {
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
        mp: policy.mp,
        maxMp: policy.maxMp,
        exp: policy.exp,
        areaId: policy.areaId,
        moneyMinor: BigInt(policy.moneyMinor),
        moneyGoldMinor: BigInt(policy.moneyGoldMinor),
        kind: policy.kind,
        gender: policy.gender,
        language: policy.language,
        body: policy.body,
        sk: policy.sk,
        honor: policy.honor,
        hpTime: BigInt(policy.hpTime),
        version: 1,
      })
      .returning();
    const hero = this.single(rows, `created hero for account ${accountId}`);
    if (!hero) throw new Error("Hero insert did not return an id");
    return hero;
  }

  async save(hero: Hero): Promise<void> {
    const updated = await this.database
      .session()
      .update(heroes)
      .set({
        level: hero.level,
        hp: hero.hp,
        maxHp: hero.maxHp,
        mp: hero.mp,
        maxMp: hero.maxMp,
        exp: hero.exp,
        areaId: hero.areaId,
        moneyMinor: BigInt(hero.moneyMinor),
        moneyGoldMinor: BigInt(hero.moneyGoldMinor),
        kind: hero.kind,
        gender: hero.gender,
        language: hero.language,
        body: hero.body,
        sk: hero.sk,
        honor: hero.honor,
        hpTime: BigInt(hero.hpTime),
        version: sql`${heroes.version} + 1`,
      })
      .where(eq(heroes.id, hero.id))
      .returning({ id: heroes.id });
    if (updated.length !== 1) {
      throw new Error(`Hero ${hero.id} was not updated`);
    }
  }

  private async loadByAccountId(accountId: number, lock: boolean): Promise<Hero | null> {
    const query = this.database
      .session()
      .select()
      .from(heroes)
      .where(eq(heroes.accountId, accountId));
    const rows = lock ? await query.for("update") : await query;
    return this.single(rows, `hero account ${accountId}`);
  }

  private single(
    rows: Array<{
      id: number;
      accountId: number;
      nick: string;
      level: number;
      hp: number;
      maxHp: number;
      mp: number;
      maxMp: number;
      exp: number;
      areaId: string;
      moneyMinor: bigint;
      moneyGoldMinor: bigint;
      kind: number;
      gender: number;
      language: string;
      body: string;
      sk: number;
      honor: number;
      hpTime: bigint;
    }>,
    key: string,
  ): Hero | null {
    if (rows.length > 1) throw new Error(`Multiple rows found for ${key}`);
    const row = rows[0];
    if (!row) return null;
    return Hero.restore(recordFromRow(row, key));
  }
}

function recordFromRow(
  row: {
    id: number;
    accountId: number;
    nick: string;
    level: number;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    exp: number;
    areaId: string;
    moneyMinor: bigint;
    moneyGoldMinor: bigint;
    kind: number;
    gender: number;
    language: string;
    body: string;
    sk: number;
    honor: number;
    hpTime: bigint;
  },
  key: string,
): HeroRecord {
  return {
    id: row.id,
    accountId: row.accountId,
    nick: row.nick,
    level: row.level,
    hp: row.hp,
    maxHp: row.maxHp,
    mp: row.mp,
    maxMp: row.maxMp,
    exp: row.exp,
    areaId: row.areaId,
    moneyMinor: safeInteger(row.moneyMinor, `money for ${key}`),
    moneyGoldMinor: safeInteger(row.moneyGoldMinor, `diamonds for ${key}`),
    kind: row.kind,
    gender: row.gender,
    language: row.language,
    body: row.body,
    sk: row.sk,
    honor: row.honor,
    hpTime: safeInteger(row.hpTime, `hpTime for ${key}`),
  };
}

function safeInteger(value: bigint, label: string): number {
  const converted = Number(value);
  if (!Number.isSafeInteger(converted)) throw new Error(`Unsafe ${label}`);
  return converted;
}
