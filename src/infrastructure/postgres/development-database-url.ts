import { postgresDatabaseName } from "./postgres-database-name.ts";

export function requireDevelopmentDatabaseUrl(
  databaseUrl = process.env.DATABASE_URL,
  testDatabaseUrl = process.env.TEST_DATABASE_URL,
): string {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const databaseName = postgresDatabaseName(databaseUrl);
  if (databaseName.endsWith("_test")) {
    throw new Error(`Refusing to reset a _test database: ${databaseName}`);
  }
  if (testDatabaseUrl && databaseUrl === testDatabaseUrl) {
    throw new Error("DATABASE_URL must not equal TEST_DATABASE_URL");
  }
  return databaseUrl;
}
