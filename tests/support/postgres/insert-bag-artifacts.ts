import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { items } from "../../../src/modules/inventory/infrastructure/schema.ts";
import { requireTestDatabaseUrl } from "./test-database-url.ts";

export async function insertBagArtifacts(
  heroId: number,
  rows: readonly Readonly<{
    artifactId: number;
    durability: number;
    durabilityMax: number;
    quantity?: number;
  }>[],
): Promise<void> {
  if (!Number.isInteger(heroId) || heroId < 1) throw new Error("heroId is required");
  if (rows.length < 1) throw new Error("insertBagArtifacts requires at least one row");
  const database = new PostgresDatabase(requireTestDatabaseUrl());
  try {
    for (const row of rows) {
      const quantity = row.quantity === undefined ? 1 : row.quantity;
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error(`insertBagArtifacts quantity for ${row.artifactId} is invalid`);
      }
      await database.session().insert(items).values({
        heroId,
        artifactId: row.artifactId,
        quantity,
        locationKind: "bag",
        durability: row.durability,
        durabilityMax: row.durabilityMax,
        upgradeId: 0,
        upgradeLevel: 0,
        upgradeSkillId: "",
        upgradeBound: 0,
        expire: 0,
        version: 1,
      });
    }
  } finally {
    await database.close();
  }
}
