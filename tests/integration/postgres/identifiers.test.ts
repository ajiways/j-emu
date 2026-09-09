import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { PostgresHeroRepository } from "../../../src/modules/character/infrastructure/postgres-hero-repository.ts";
import { PostgresFightIdSource } from "../../../src/modules/combat/infrastructure/postgres-fight-id-source.ts";
import { PostgresAccountRepository } from "../../../src/modules/identity/infrastructure/postgres-account-repository.ts";
import { items } from "../../../src/modules/inventory/infrastructure/schema.ts";
import { PostgresInventoryRepository } from "../../../src/modules/inventory/infrastructure/postgres-inventory-repository.ts";
import { playableNewHero } from "../../support/hero-fixtures.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";

const databaseUrl = requireTestDatabaseUrl();
const NATIVE_SPELL_IDS = [1, 2, 3, 5, 6, 7, 10];

describe("PostgreSQL identifiers", () => {
  let database: PostgresDatabase;

  beforeAll(async () => {
    database = new PostgresDatabase(databaseUrl);
  });

  afterAll(async () => {
    await database.close();
  });

  it("issues unique item and fight IDs under parallel transactions", async () => {
    const { hero } = await seedHero(`parallel-${crypto.randomUUID()}`);
    const clients = Array.from({ length: 8 }, () => new PostgresDatabase(databaseUrl));
    try {
      const [itemIds, fightIds] = await Promise.all([
        Promise.all(
          clients.map((client) =>
            new PostgresInventoryRepository(client)
              .create({
                heroId: hero.id,
                artifactId: 9095,
                quantity: 1,
                location: { kind: "bag" },
                durability: 3,
                durabilityMax: 3,
              })
              .then((item) => item.id),
          ),
        ),
        Promise.all(clients.map((client) => new PostgresFightIdSource(client).nextFightId())),
      ]);
      expect(new Set(itemIds).size).toBe(itemIds.length);
      expect(new Set(fightIds).size).toBe(fightIds.length);
      expect(itemIds.every((id) => id >= 100_000 && id <= 2_147_483_647)).toBe(true);
      expect(itemIds.every((id) => !NATIVE_SPELL_IDS.includes(id))).toBe(true);
      expect(fightIds.every((id) => /^[1-9][0-9]*$/.test(id))).toBe(true);
      expect(hero.id).toBeGreaterThanOrEqual(1);
      expect(hero.id).toBeLessThanOrEqual(2_147_483_647);
    } finally {
      await Promise.all(clients.map((client) => client.close()));
    }
  });

  it("rejects item ids below 100000 that would collide with native spells", async () => {
    const { hero } = await seedHero(`collide-${crypto.randomUUID()}`);
    try {
      await database.session().insert(items).values({
        id: 2n,
        heroId: hero.id,
        artifactId: 9095,
        quantity: 1,
        locationKind: "bag",
        pocketPosition: null,
        equipmentSlot: null,
        durability: 3,
        durabilityMax: 3,
        upgradeId: 0,
        upgradeLevel: 0,
        upgradeSkillId: "",
        upgradeBound: 0,
        version: 1,
      });
      throw new Error("Expected items_id_fight_safe to reject native spell id 2");
    } catch (error) {
      expect(errorText(error)).toMatch(/items_id_fight_safe/);
    }
  });

  it("does not reuse a sequence value after a rolled-back insert", async () => {
    const { hero, inventory } = await seedHero(`gap-${crypto.randomUUID()}`);
    let consumed = 0;
    await expect(
      database.run(async () => {
        const item = await inventory.create({
          heroId: hero.id,
          artifactId: 9095,
          quantity: 1,
          location: { kind: "bag" },
          durability: 3,
          durabilityMax: 3,
        });
        consumed = item.id;
        throw new Error("rollback after nextval");
      }),
    ).rejects.toThrow("rollback after nextval");
    expect((await inventory.listForHero(hero.id)).some((item) => item.id === consumed)).toBe(false);
    const next = await inventory.create({
      heroId: hero.id,
      artifactId: 9095,
      quantity: 1,
      location: { kind: "bag" },
      durability: 3,
      durabilityMax: 3,
    });
    expect(next.id).toBeGreaterThan(consumed);
  });

  it("does not reuse IDs after reconnect", async () => {
    const { hero, inventory } = await seedHero(`restart-${crypto.randomUUID()}`);
    const first = await inventory.create({
      heroId: hero.id,
      artifactId: 9095,
      quantity: 1,
      location: { kind: "bag" },
      durability: 3,
      durabilityMax: 3,
    });
    const fights = new PostgresFightIdSource(database);
    const firstFight = await fights.nextFightId();
    await database.close();
    database = new PostgresDatabase(databaseUrl);
    const reopened = new PostgresInventoryRepository(database);
    const second = await reopened.create({
      heroId: hero.id,
      artifactId: 9095,
      quantity: 1,
      location: { kind: "bag" },
      durability: 3,
      durabilityMax: 3,
    });
    const reopenedFights = new PostgresFightIdSource(database);
    const secondFight = await reopenedFights.nextFightId();
    expect(second.id).toBeGreaterThan(first.id);
    expect(BigInt(secondFight) > BigInt(firstFight)).toBe(true);
  });

  async function seedHero(slug: string) {
    const accounts = new PostgresAccountRepository(database);
    const heroes = new PostgresHeroRepository(database);
    const inventory = new PostgresInventoryRepository(database);
    const account = await accounts.create(`id-${slug}`, `Id-${slug}`, null);
    const hero = await heroes.create(playableNewHero(account.id, account.nick));
    return { hero, inventory };
  }
});

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? error.cause.message : "";
  return `${error.message}\n${cause}`;
}
