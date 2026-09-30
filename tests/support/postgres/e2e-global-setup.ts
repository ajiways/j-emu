import path from "node:path";
import postgres from "postgres";
import { migrateDatabase } from "../../../src/infrastructure/postgres/migration-runner.ts";
import { publishDevelopmentContent } from "../../../src/infrastructure/postgres/publish-development-content.ts";
import { recreateDatabase } from "../../../src/infrastructure/postgres/recreate-database.ts";
import { postgresDatabaseName } from "../../../src/infrastructure/postgres/postgres-database-name.ts";
import { requireTestDatabaseUrl } from "./test-database-url.ts";
import { workerDatabaseUrl } from "./worker-database.ts";

/** Builds the migrated, published template once and clones it for every worker. */
export default async function setup(): Promise<void> {
  const templateUrl = requireTestDatabaseUrl();
  const workers = Number(process.env.E2E_WORKERS);
  if (!Number.isInteger(workers) || workers < 1) throw new Error("E2E_WORKERS is required");
  await recreateDatabase(templateUrl, "recreate");
  await migrateDatabase(templateUrl, path.resolve(process.cwd(), "drizzle"));
  await publishDevelopmentContent(
    templateUrl,
    path.resolve(process.cwd(), "content/playable-slice.json"),
  );
  const adminUrl = new URL(templateUrl);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    const template = postgresDatabaseName(templateUrl);
    for (let id = 1; id <= workers; id += 1) {
      const name = postgresDatabaseName(workerDatabaseUrl(templateUrl, id));
      await admin`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname IN (${template}, ${name}) AND pid <> pg_backend_pid()
      `;
      // Drizzle has no CREATE DATABASE ... TEMPLATE; this is an operational admin command.
      await admin.unsafe(`DROP DATABASE IF EXISTS "${name}"`);
      await admin.unsafe(`CREATE DATABASE "${name}" TEMPLATE "${template}"`);
    }
  } finally {
    await admin.end({ timeout: 5 });
  }
}
