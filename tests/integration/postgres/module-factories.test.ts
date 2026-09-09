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
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { ManualCombatDelay } from "../../support/fakes/manual-combat-delay.ts";
import { SystemClock } from "../../../src/shared/kernel/system-clock.ts";

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
    const clock = new SystemClock();
    const identity = IdentityModule.create({ database, clock });
    await expect(identity.close()).resolves.toBeUndefined();
    const combat = CombatModule.create({
      database,
      rules: UNIT_BATTLE_RULES,
      clock,
      delay: new ManualCombatDelay(),
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
