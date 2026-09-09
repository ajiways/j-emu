import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadGamePolicy } from "../../../src/app/game-policy.ts";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { publishDevelopmentContent } from "../../../src/infrastructure/postgres/publish-development-content.ts";
import { CatalogModule } from "../../../src/modules/catalog/catalog-module.ts";
import { CharacterModule } from "../../../src/modules/character/character-module.ts";
import { IdentityModule } from "../../../src/modules/identity/identity-module.ts";
import { InventoryModule } from "../../../src/modules/inventory/inventory-module.ts";
import { PostgresInventoryRepository } from "../../../src/modules/inventory/infrastructure/postgres-inventory-repository.ts";
import { uniqueDevelopmentSlot } from "../../support/harness/unique-development-slot.ts";
import { playableCharacterModuleInput } from "../../support/playable-character-module-input.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";
import { SystemClock } from "../../../src/shared/kernel/system-clock.ts";

const databaseUrl = requireTestDatabaseUrl();
const policy = loadGamePolicy(path.resolve(process.cwd(), "config/development.json"));

describe("inventory pocket persistence", () => {
  let database: PostgresDatabase;
  let identity: IdentityModule;
  let characters: CharacterModule;
  let inventory: InventoryModule;
  let catalog: CatalogModule;

  beforeAll(async () => {
    await publishDevelopmentContent(
      databaseUrl,
      path.resolve(process.cwd(), "content/playable-slice.json"),
    );
    database = new PostgresDatabase(databaseUrl);
    identity = IdentityModule.create({ database, clock: new SystemClock() });
    catalog = await CatalogModule.create({ database });
    inventory = InventoryModule.create({
      database,
      starterItems: policy.starterItems,
      releaseArtifacts: catalog.releaseArtifacts,
      catalog: catalog.catalog,
      bagCapacity: policy.bootstrap.bagCapacity,
      pocketCapacity: policy.bootstrap.pocketCapacity,
    });
    characters = CharacterModule.create(
      playableCharacterModuleInput(
        database,
        catalog.progression,
        inventory.service,
        catalog.catalog,
        {
          creationPolicy: policy.heroCreation,
        },
      ),
    );
  });

  afterAll(async () => {
    await identity.close();
    await characters.close();
    await inventory.close();
    await catalog.close();
    await database.close();
  });

  it("rejects a second row in the same pocket_position", async () => {
    const hero = await createHero();
    const repository = new PostgresInventoryRepository(database);
    await repository.create({
      heroId: hero.id,
      artifactId: 93,
      quantity: 1,
      location: { kind: "pocket", position: 1 },
    });
    await expect(
      repository.create({
        heroId: hero.id,
        artifactId: 99,
        quantity: 1,
        location: { kind: "pocket", position: 1 },
      }),
    ).rejects.toSatisfy(isUniqueViolation);
  });

  it("serializes concurrent PUT_ON of the same pocket cell", async () => {
    const hero = await createHero();
    const elixir = requireArtikul(await inventory.service.list(hero.id), 93);
    const orb = requireArtikul(await inventory.service.list(hero.id), 99);
    const elixirDef = await requireDefinition(93);
    const orbDef = await requireDefinition(99);
    await Promise.allSettled([
      database.run(async () => inventory.service.putOn(hero, elixir.id, elixirDef, 1)),
      database.run(async () => inventory.service.putOn(hero, orb.id, orbDef, 1)),
    ]);
    const pocket = await inventory.service.listPocket({ characterId: hero.id });
    const slotOne = pocket.filter(
      (item) => item.location.kind === "pocket" && item.location.position === 1,
    );
    expect(slotOne).toHaveLength(1);
  });

  it("rolls back a pocket PUT_ON in a failed unit of work", async () => {
    const hero = await createHero();
    const elixir = requireArtikul(await inventory.service.list(hero.id), 93);
    const definition = await requireDefinition(93);
    await expect(
      database.run(async () => {
        await inventory.service.putOn(hero, elixir.id, definition);
        throw new Error("forced rollback");
      }),
    ).rejects.toThrow(/forced rollback/);
    expect(await inventory.service.listPocket({ characterId: hero.id })).toEqual([]);
    expect(requireArtikul(await inventory.service.list(hero.id), 93).quantity).toBe(2);
  });

  it("merges pocket PUT_OFF into an existing bag stack", async () => {
    const hero = await createHero();
    const elixir = requireArtikul(await inventory.service.list(hero.id), 93);
    const definition = await requireDefinition(93);
    await database.run(async () => inventory.service.putOn(hero, elixir.id, definition));
    const pocket = await inventory.service.listPocket({ characterId: hero.id });
    expect(pocket).toHaveLength(1);
    await database.run(async () => inventory.service.putOff(hero.id, pocket[0]!.id));
    const bagElixirs = (await inventory.service.list(hero.id)).filter(
      (item) => item.artifactId === 93 && item.location.kind === "bag",
    );
    expect(bagElixirs).toHaveLength(1);
    expect(bagElixirs[0]?.quantity).toBe(2);
    expect(await inventory.service.listPocket({ characterId: hero.id })).toEqual([]);
  });

  it("merges a bag orb into an incomplete pocket stack", async () => {
    const hero = await createHero();
    const starterOrb = requireArtikul(await inventory.service.list(hero.id), 99);
    await database.run(async () =>
      inventory.service.drop({ characterId: hero.id, itemId: starterOrb.id }),
    );
    const repository = new PostgresInventoryRepository(database);
    const pocket = await repository.create({
      heroId: hero.id,
      artifactId: 99,
      quantity: 5,
      location: { kind: "pocket", position: 1 },
    });
    const bag = await repository.create({
      heroId: hero.id,
      artifactId: 99,
      quantity: 8,
      location: { kind: "bag" },
    });
    const definition = await requireDefinition(99);
    await database.run(async () => inventory.service.putOn(hero, bag.id, definition, 1));
    const after = await inventory.service.list(hero.id);
    const pocketOrb = after.find((item) => item.id === pocket.id);
    const bagOrb = after.find((item) => item.id === bag.id);
    expect(pocketOrb).toMatchObject({ quantity: 10, location: { kind: "pocket", position: 1 } });
    expect(bagOrb).toMatchObject({ quantity: 3, location: { kind: "bag" } });
  });

  async function createHero() {
    const slot = uniqueDevelopmentSlot();
    const account = await identity.service.register(`u${slot}`, `N${slot}`, "secret1");
    const hero = await characters.service.getOrCreateForAccount(
      account.account.id,
      account.account.nick,
    );
    await inventory.service.ensureStarterInventory(hero.id);
    return hero;
  }

  async function requireDefinition(artifactId: number) {
    const definition = await catalog.catalog.artifact(artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${artifactId} is missing`);
    return definition;
  }
});

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const record = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (record.code === "23505") return true;
    if (typeof record.message === "string" && /unique|duplicate/i.test(record.message)) return true;
    current = record.cause;
  }
  return false;
}

function requireArtikul(
  items: readonly { id: number; artifactId: number; quantity: number; location: unknown }[],
  artifactId: number,
) {
  const matches = items.filter((item) => item.artifactId === artifactId);
  if (matches.length !== 1) throw new Error(`expected one item ${artifactId}`);
  const item = matches[0];
  if (!item) throw new Error(`item ${artifactId} is missing`);
  return item;
}
