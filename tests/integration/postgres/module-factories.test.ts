import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { migrateDatabase } from "../../../src/infrastructure/postgres/migration-runner.ts";
import { CatalogModule } from "../../../src/modules/catalog/catalog-module.ts";
import { CombatModule } from "../../../src/modules/combat/combat-module.ts";
import { IdentityModule } from "../../../src/modules/identity/identity-module.ts";
import { WorldModule } from "../../../src/modules/world/world-module.ts";
import {
  requireTestDatabaseUrl,
  testDatabaseName,
} from "../../support/postgres/test-database-url.ts";
import { withIsolatedTestDatabase } from "../../support/postgres/isolated-test-database.ts";

const databaseUrl = requireTestDatabaseUrl();

describe("module factory lifecycle", () => {
  let database: PostgresDatabase;

  beforeAll(async () => {
    database = new PostgresDatabase(databaseUrl);
  });

  afterAll(async () => {
    await database.close();
  });

  it("creates and closes identity and combat modules against PostgreSQL", async () => {
    const identity = IdentityModule.create({ database });
    await expect(identity.close()).resolves.toBeUndefined();
    const combat = CombatModule.create({
      database,
      rules: {
        playerDamageMin: 8,
        playerDamageMax: 12,
        botDamageMin: 2,
        botDamageMax: 4,
        turnTimeoutSeconds: 20,
      },
    });
    await expect(combat.close()).resolves.toBeUndefined();
  });

  it("fails catalog and world startup without a published revision", async () => {
    const sourceName = testDatabaseName(databaseUrl).replace(/_test$/, "");
    await withIsolatedTestDatabase(`${sourceName}_modelfactory_test`, async (isolatedUrl) => {
      await migrateDatabase(isolatedUrl);
      const isolated = new PostgresDatabase(isolatedUrl);
      try {
        await expect(CatalogModule.create({ database: isolated })).rejects.toThrow(
          /published content/,
        );
        await expect(WorldModule.create({ database: isolated })).rejects.toThrow(
          /published content/,
        );
      } finally {
        await isolated.close();
      }
    });
  });
});
