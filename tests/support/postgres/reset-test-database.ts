import path from "node:path";
import postgres from "postgres";
import { migrateDatabase } from "../../../src/infrastructure/postgres/migration-runner.ts";
import { requireTestDatabaseUrl, testDatabaseName } from "./test-database-url.ts";

const testDatabaseUrl = requireTestDatabaseUrl();
const databaseName = testDatabaseName(testDatabaseUrl);

const adminUrl = new URL(testDatabaseUrl);
adminUrl.pathname = "/postgres";
const admin = postgres(adminUrl.toString(), { max: 1 });
try {
  await admin`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = ${databaseName} AND pid <> pg_backend_pid()
  `;
  // Drizzle has no CREATE/DROP DATABASE; this is a test-only admin command.
  await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}"`);
  await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
} finally {
  await admin.end();
}

await migrateDatabase(testDatabaseUrl, path.resolve(process.cwd(), "drizzle"));
