import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadGamePolicy } from "../../../src/app/game-policy.ts";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { publishDevelopmentContent } from "../../../src/infrastructure/postgres/publish-development-content.ts";
import { CatalogModule } from "../../../src/modules/catalog/catalog-module.ts";
import { CharacterModule } from "../../../src/modules/character/character-module.ts";
import { IdentityModule } from "../../../src/modules/identity/identity-module.ts";
import { InventoryModule } from "../../../src/modules/inventory/inventory-module.ts";
import { QuestsModule } from "../../../src/modules/quests/quests-module.ts";
import { PostgresHeroQuestRepository } from "../../../src/modules/quests/infrastructure/postgres-hero-quest-repository.ts";
import { uniqueDevelopmentSlot } from "../../support/harness/unique-development-slot.ts";
import { playableCharacterModuleInput } from "../../support/playable-character-module-input.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";
import { FakeClock } from "../../support/fake-clock.ts";

const databaseUrl = requireTestDatabaseUrl();
const policy = loadGamePolicy(path.resolve(process.cwd(), "config/development.json"));
const AFTER_6_MS = Date.UTC(2026, 7, 29, 3, 1, 0);
const YESTERDAY = new Date(Date.UTC(2026, 7, 28, 12, 0, 0));

describe("daily quest journal persistence", () => {
  let database: PostgresDatabase;
  let identity: IdentityModule;
  let characters: CharacterModule;
  let inventory: InventoryModule;
  let catalog: CatalogModule;
  let quests: QuestsModule;
  const clock = new FakeClock(AFTER_6_MS);

  beforeAll(async () => {
    await publishDevelopmentContent(
      databaseUrl,
      path.resolve(process.cwd(), "content/playable-slice.json"),
    );
    database = new PostgresDatabase(databaseUrl);
    identity = IdentityModule.create({ database, clock });
    catalog = await CatalogModule.create({ database });
    inventory = InventoryModule.create({
      database,
      starterItems: policy.starterItems,
      releaseArtifacts: catalog.releaseArtifacts,
      catalog: catalog.catalog,
      bagCapacity: policy.bootstrap.bagCapacity,
      pocketCapacity: policy.bootstrap.pocketCapacity,
      random: { unit: () => 0 },
    });
    characters = CharacterModule.create(
      playableCharacterModuleInput(
        database,
        catalog.progression,
        inventory.service,
        catalog.catalog,
        { clock, creationPolicy: policy.heroCreation },
      ),
    );
    quests = QuestsModule.create({ database, clock });
  });

  afterAll(async () => {
    await identity.close();
    await characters.close();
    await inventory.close();
    await catalog.close();
    await quests.close();
    await database.close();
  });

  it("persists hidden_in_journal across a new repository read", async () => {
    const hero = await createHero();
    const progress = new PostgresHeroQuestRepository(database);
    const now = clock.now();
    await progress.insert({
      heroId: hero.id,
      questKey: "q_engine_daily",
      bookId: 4,
      dialogStep: 0,
      dialogCursor: "0",
      startedAt: now,
      hiddenInJournal: 0,
    });
    await progress.update(hero.id, "q_engine_daily", { status: "done", finishedAt: now });
    await database.run(async () => {
      await quests.service.hideJournal(hero.id, 4);
    });
    const hidden = await progress.find(hero.id, "q_engine_daily");
    expect(hidden?.hiddenInJournal).toBe(1);
    expect(hidden?.status).toBe("done");
  });

  it("deletes a stale daily on the next book read", async () => {
    const hero = await createHero();
    const progress = new PostgresHeroQuestRepository(database);
    await progress.insert({
      heroId: hero.id,
      questKey: "q_engine_daily",
      bookId: 4,
      dialogStep: 0,
      dialogCursor: "0",
      startedAt: YESTERDAY,
      hiddenInJournal: 0,
    });
    await progress.update(hero.id, "q_engine_daily", {
      status: "done",
      finishedAt: YESTERDAY,
    });
    await database.run(async () => {
      await quests.service.bookSnapshot(hero.id, "started");
    });
    expect(await progress.find(hero.id, "q_engine_daily")).toBeNull();
  });

  it("lets concurrent wipes delete a stale daily once", async () => {
    const hero = await createHero();
    const progress = new PostgresHeroQuestRepository(database);
    await progress.insert({
      heroId: hero.id,
      questKey: "q_engine_daily",
      bookId: 4,
      dialogStep: 0,
      dialogCursor: "0",
      startedAt: YESTERDAY,
      hiddenInJournal: 0,
    });
    const firstClient = new PostgresDatabase(databaseUrl);
    const secondClient = new PostgresDatabase(databaseUrl);
    try {
      const left = QuestsModule.create({ database: firstClient, clock });
      const right = QuestsModule.create({ database: secondClient, clock });
      await Promise.all([
        firstClient.run(async () => left.service.bookSnapshot(hero.id, "started")),
        secondClient.run(async () => right.service.bookSnapshot(hero.id, "started")),
      ]);
      await left.close();
      await right.close();
    } finally {
      await Promise.all([firstClient.close(), secondClient.close()]);
    }
    expect(await progress.find(hero.id, "q_engine_daily")).toBeNull();
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
});
