import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { PostgresHeroRepository } from "../../../src/modules/character/infrastructure/postgres-hero-repository.ts";
import { PostgresFightIdSource } from "../../../src/modules/combat/infrastructure/postgres-fight-id-source.ts";
import { PostgresAccountRepository } from "../../../src/modules/identity/infrastructure/postgres-account-repository.ts";
import { PostgresInventoryRepository } from "../../../src/modules/inventory/infrastructure/postgres-inventory-repository.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";

const databaseUrl = requireTestDatabaseUrl();

describe("PostgreSQL identifiers", () => {
  let database: PostgresDatabase;

  beforeAll(async () => {
    database = new PostgresDatabase(databaseUrl);
  });

  afterAll(async () => {
    await database.close();
  });

  it("issues unique item, fight and participant IDs under parallel transactions", async () => {
    const { hero } = await seedHero(`parallel-${crypto.randomUUID()}`);
    const clients = Array.from({ length: 8 }, () => new PostgresDatabase(databaseUrl));
    try {
      const [itemIds, fightIds, participantIds] = await Promise.all([
        Promise.all(
          clients.map((client) =>
            new PostgresInventoryRepository(client)
              .create({
                heroId: hero.id,
                artifactId: 9095,
                quantity: 1,
                location: { kind: "bag" },
              })
              .then((item) => item.id),
          ),
        ),
        Promise.all(clients.map((client) => new PostgresFightIdSource(client).nextFightId())),
        Promise.all(clients.map((client) => new PostgresFightIdSource(client).nextParticipantId())),
      ]);
      expect(new Set(itemIds).size).toBe(itemIds.length);
      expect(new Set(fightIds).size).toBe(fightIds.length);
      expect(new Set(participantIds.map(String)).size).toBe(participantIds.length);
      expect(itemIds.every((id) => id >= 1_000_000_000)).toBe(true);
    } finally {
      await Promise.all(clients.map((client) => client.close()));
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
    });
    const fights = new PostgresFightIdSource(database);
    const firstFight = await fights.nextFightId();
    const firstParticipant = await fights.nextParticipantId();
    await database.close();
    database = new PostgresDatabase(databaseUrl);
    const reopened = new PostgresInventoryRepository(database);
    const second = await reopened.create({
      heroId: hero.id,
      artifactId: 9095,
      quantity: 1,
      location: { kind: "bag" },
    });
    const reopenedFights = new PostgresFightIdSource(database);
    const secondFight = await reopenedFights.nextFightId();
    const secondParticipant = await reopenedFights.nextParticipantId();
    expect(second.id).toBeGreaterThan(first.id);
    expect(BigInt(secondFight) > BigInt(firstFight)).toBe(true);
    expect(secondParticipant > firstParticipant).toBe(true);
  });

  async function seedHero(slug: string) {
    const accounts = new PostgresAccountRepository(database);
    const heroes = new PostgresHeroRepository(database);
    const inventory = new PostgresInventoryRepository(database);
    const account = await accounts.create(`id-${slug}`, `Id-${slug}`, null);
    const hero = await heroes.create(account.id, account.nick, {
      level: 1,
      hp: 27,
      maxHp: 27,
      areaId: "503",
      moneyMinor: 2500,
    });
    return { hero, inventory };
  }
});
