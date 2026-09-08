import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadGamePolicy } from "../../../src/app/game-policy.ts";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { migrateDatabase } from "../../../src/infrastructure/postgres/migration-runner.ts";
import { CatalogModule } from "../../../src/modules/catalog/catalog-module.ts";
import { CharacterModule } from "../../../src/modules/character/character-module.ts";
import type { ContentBundle } from "../../../src/modules/content/domain/content-document.ts";
import { createPostgresContentPublication } from "../../../src/modules/content/infrastructure/create-postgres-content-publication.ts";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";
import { IdentityModule } from "../../../src/modules/identity/identity-module.ts";
import { InventoryModule } from "../../../src/modules/inventory/inventory-module.ts";
import { SystemClock } from "../../../src/shared/kernel/system-clock.ts";
import { uniqueDevelopmentSlot } from "../../support/harness/unique-development-slot.ts";
import { playableCharacterModuleInput } from "../../support/playable-character-module-input.ts";
import { withIsolatedTestDatabase } from "../../support/postgres/isolated-test-database.ts";
import {
  requireTestDatabaseUrl,
  testDatabaseName,
} from "../../support/postgres/test-database-url.ts";

const databaseUrl = requireTestDatabaseUrl();
const policy = loadGamePolicy(path.resolve(process.cwd(), "config/development.json"));
const playablePath = path.resolve(process.cwd(), "content/playable-slice.json");
const playable = loadContentBundleFile(playablePath);

describe("experience grant activation races", () => {
  it("pins one release when a compatible activation races the grant", async () => {
    const sourceName = testDatabaseName(databaseUrl).replace(/_test$/, "");
    await withIsolatedTestDatabase(`${sourceName}_grantact_test`, async (isolatedUrl) => {
      await migrateDatabase(isolatedUrl);
      const database = new PostgresDatabase(isolatedUrl);
      const grantClient = new PostgresDatabase(isolatedUrl);
      const publishClient = new PostgresDatabase(isolatedUrl);
      try {
        const publication = createPostgresContentPublication(database);
        const seeded = await publication.seed(playable, playablePath);
        const identity = IdentityModule.create({ database, clock: new SystemClock() });
        const catalog = await CatalogModule.create({ database });
        const inventory = InventoryModule.create({
          database,
          starterItems: policy.starterItems,
          releaseArtifacts: catalog.releaseArtifacts,
          catalog: catalog.catalog,
          bagCapacity: policy.bootstrap.bagCapacity,
        });
        const characters = CharacterModule.create(
          playableCharacterModuleInput(database, catalog.progression, inventory.service, {
            creationPolicy: policy.heroCreation,
          }),
        );
        const slot = uniqueDevelopmentSlot();
        const account = await identity.service.register(`u${slot}`, `N${slot}`, "secret1");
        const hero = await characters.service.getOrCreateForAccount(
          account.account.id,
          account.account.nick,
        );
        const glove = playable.artifacts[0];
        if (!glove) throw new Error("Playable bundle is missing artifact 9095");
        const extraArtifact: ContentBundle = {
          ...playable,
          artifacts: [...playable.artifacts, { ...glove, id: 9096, title: "Другая" }],
        };
        const grantCatalog = await CatalogModule.create({ database: grantClient });
        const grantInventory = InventoryModule.create({
          database: grantClient,
          starterItems: policy.starterItems,
          releaseArtifacts: grantCatalog.releaseArtifacts,
          catalog: grantCatalog.catalog,
          bagCapacity: policy.bootstrap.bagCapacity,
        });
        const grantCharacters = CharacterModule.create(
          playableCharacterModuleInput(
            grantClient,
            grantCatalog.progression,
            grantInventory.service,
            {
              creationPolicy: policy.heroCreation,
            },
          ),
        );
        const [granted, published] = await Promise.all([
          grantCharacters.service.grantExperience({
            characterId: hero.id,
            operationId: `test:${hero.id}:race`,
            amount: 10,
          }),
          createPostgresContentPublication(publishClient).publish(extraArtifact),
        ]);
        expect(published.id).not.toBe(seeded.id);
        expect([seeded.id, published.id]).toContain(granted.contentReleaseId);
        expect(granted.progressionDigest).toMatch(/^[0-9a-f]{64}$/);
        expect(granted).toMatchObject({ expAfter: 11, levelAfter: 1, levelsGained: 0 });
        const stored = await characters.service.getByAccountId(hero.accountId);
        expect(stored?.exp).toBe(11);
      } finally {
        await Promise.all([database.close(), grantClient.close(), publishClient.close()]);
      }
    });
  });
});
