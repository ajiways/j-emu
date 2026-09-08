import { recreateDatabase } from "../../../src/infrastructure/postgres/recreate-database.ts";
import { requireTestDatabaseUrl, testDatabaseName } from "./test-database-url.ts";

export async function withIsolatedTestDatabase(
  name: string,
  work: (databaseUrl: string) => Promise<void>,
): Promise<void> {
  requireTestDatabaseUrl();
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to create database without _test suffix: ${name}`);
  }
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Test database name contains unsupported characters: ${name}`);
  }
  const baseUrl = new URL(requireTestDatabaseUrl());
  if (name === testDatabaseName(baseUrl.toString())) {
    throw new Error("Isolated test database must not reuse TEST_DATABASE_URL");
  }
  const isolatedUrl = new URL(baseUrl.toString());
  isolatedUrl.pathname = `/${name}`;
  const isolated = isolatedUrl.toString();
  try {
    await recreateDatabase(isolated, "recreate");
    await work(isolated);
  } finally {
    await recreateDatabase(isolated, "drop");
  }
}
