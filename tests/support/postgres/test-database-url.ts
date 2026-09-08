import { postgresDatabaseName } from "../../../src/infrastructure/postgres/postgres-database-name.ts";

export function requireTestDatabaseUrl(
  testDatabaseUrl = process.env.TEST_DATABASE_URL,
  productionDatabaseUrl = process.env.DATABASE_URL,
): string {
  if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required");
  const databaseName = postgresDatabaseName(testDatabaseUrl);
  if (!databaseName.endsWith("_test")) {
    throw new Error(`Refusing to use database without _test suffix: ${databaseName}`);
  }
  if (productionDatabaseUrl && testDatabaseUrl === productionDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL must not equal DATABASE_URL");
  }
  return testDatabaseUrl;
}

export function testDatabaseName(testDatabaseUrl: string): string {
  return postgresDatabaseName(testDatabaseUrl);
}
