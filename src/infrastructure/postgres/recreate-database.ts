import postgres from "postgres";
import { postgresDatabaseName } from "./postgres-database-name.ts";

export async function recreateDatabase(
  databaseUrl: string,
  mode: "recreate" | "drop",
): Promise<void> {
  const name = postgresDatabaseName(databaseUrl);
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    await admin`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = ${name} AND pid <> pg_backend_pid()
    `;
    // Drizzle has no CREATE/DROP DATABASE; this is an operational admin command.
    await admin.unsafe(`DROP DATABASE IF EXISTS "${name}"`);
    if (mode === "recreate") await admin.unsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }
}
