import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { items } from "../../../src/modules/inventory/infrastructure/schema.ts";
import { requireTestDatabaseUrl } from "./test-database-url.ts";

export async function insertWeightedBagRows(heroId: number, extraRows: number): Promise<void> {
  if (!Number.isInteger(heroId) || heroId < 1) throw new Error("heroId is required");
  if (!Number.isInteger(extraRows) || extraRows < 1) {
    throw new Error("extraRows must be a positive integer");
  }
  const database = new PostgresDatabase(requireTestDatabaseUrl());
  try {
    for (let i = 0; i < extraRows; i += 1) {
      await database.session().insert(items).values({
        heroId,
        artifactId: 93,
        quantity: 1,
        locationKind: "bag",
        durability: 0,
        durabilityMax: 0,
        version: 1,
      });
    }
  } finally {
    await database.close();
  }
}
