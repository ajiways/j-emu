import { asc, eq, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { Hero, type HeroRecord, type NewHero } from "../domain/hero.ts";
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

  async listByAreaId(areaId: string): Promise<readonly Hero[]> {
    if (!areaId) throw new Error("Area id is required");
    const rows = await this.database
      .session()
      .select()
      .from(heroes)
      .where(eq(heroes.areaId, areaId))
      .orderBy(asc(heroes.accountId));
    return rows.map((row) => Hero.restore(recordFromRow(row, `hero area ${areaId}`)));
  }

  async lockByAccountId(accountId: number): Promise<Hero | null> {
    return this.loadByAccountId(accountId, true);
  }

  async lockById(id: number): Promise<Hero | null> {
    const rows = await this.database
      .session()
      .select()
      .from(heroes)
      .where(eq(heroes.id, id))
      .for("update");
    return this.single(rows, `hero id ${id}`);
  }

  async create(values: NewHero): Promise<Hero> {
    const rows = await this.database
      .session()
      .insert(heroes)
      .values({
        accountId: values.accountId,
        nick: values.nick,
        level: values.level,
        hp: values.hp,
        maxHp: values.maxHp,
        mp: values.mp,
        maxMp: values.maxMp,
        exp: values.exp,
        areaId: values.areaId,
        moneyMinor: BigInt(values.moneyMinor),
        moneyGoldMinor: BigInt(values.moneyGoldMinor),
        kind: values.kind,
        gender: values.gender,
        language: values.language,
        body: values.body,
        sk: values.sk,
        honor: values.honor,
        hpTime: BigInt(values.hpTime),
        regenAt: values.regenAt,
        moveReadyAt: values.moveReadyAt,
        version: 1,
      })
      .returning();
    const hero = this.single(rows, `created hero for account ${values.accountId}`);
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
        regenAt: hero.regenAt,
        moveReadyAt: hero.moveReadyAt,
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
      regenAt: Date;
      moveReadyAt: Date | null;
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
    regenAt: Date;
    moveReadyAt: Date | null;
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
    regenAt: requireTimestamp(row.regenAt, `regen_at for ${key}`),
    moveReadyAt: optionalTimestamp(row.moveReadyAt, `move_ready_at for ${key}`),
  };
}

function optionalTimestamp(value: Date | null, label: string): Date | null {
  if (value === null) return null;
  return requireTimestamp(value, label);
}

function requireTimestamp(value: Date, label: string): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function safeInteger(value: bigint, label: string): number {
  const converted = Number(value);
  if (!Number.isSafeInteger(converted)) throw new Error(`Unsafe ${label}`);
  return converted;
}
