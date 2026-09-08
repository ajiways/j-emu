import path from "node:path";
import { migrateDatabase } from "../../../src/infrastructure/postgres/migration-runner.ts";
import { recreateDatabase } from "../../../src/infrastructure/postgres/recreate-database.ts";
import { requireTestDatabaseUrl } from "./test-database-url.ts";

const testDatabaseUrl = requireTestDatabaseUrl();
await recreateDatabase(testDatabaseUrl, "recreate");
await migrateDatabase(testDatabaseUrl, path.resolve(process.cwd(), "drizzle"));
