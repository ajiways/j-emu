import postgres from "postgres";
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
  const adminUrl = new URL(baseUrl.toString());
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    await recreate(admin, name);
    await work(isolatedUrl.toString());
  } finally {
    try {
      await recreate(admin, name, true);
    } finally {
      await admin.end({ timeout: 5 });
    }
  }
}

async function recreate(admin: postgres.Sql, name: string, dropOnly = false): Promise<void> {
  await admin`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = ${name} AND pid <> pg_backend_pid()
  `;
  // Drizzle has no CREATE/DROP DATABASE; this is a test-only admin command.
  await admin.unsafe(`DROP DATABASE IF EXISTS "${name}"`);
  if (!dropOnly) await admin.unsafe(`CREATE DATABASE "${name}"`);
}
