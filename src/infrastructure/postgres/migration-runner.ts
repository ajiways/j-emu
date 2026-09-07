import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const drizzleMigrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../drizzle",
);

export async function migrateDatabase(
  databaseUrl: string,
  migrationsFolder = drizzleMigrationsFolder,
): Promise<void> {
  if (!databaseUrl) throw new Error("Database URL is required");
  const migrations = readMigrationFiles({ migrationsFolder });
  if (migrations.length === 0) throw new Error("No Drizzle migrations found");

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);
  try {
    await assertAppliedMigrationsUnchanged(db, migrations);
    await migrate(db, { migrationsFolder });
  } finally {
    await client.end({ timeout: 5 });
  }
}

async function assertAppliedMigrationsUnchanged(
  db: ReturnType<typeof drizzle>,
  migrations: ReturnType<typeof readMigrationFiles>,
): Promise<void> {
  const schemas = await db.execute<{ schema_name: string }>(
    sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'drizzle'`,
  );
  if (schemas.length === 0) return;

  const tables = await db.execute<{ table_name: string }>(
    sql`SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'`,
  );
  if (tables.length === 0) return;

  const applied = await db.execute<{ hash: string; created_at: string }>(
    sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`,
  );
  for (const row of applied) {
    const file =
      migrations.find((migration) => migration.hash === row.hash) ??
      migrations.find((migration) => migration.folderMillis === Number(row.created_at));
    if (!file) {
      throw new Error(`Applied migration ${row.created_at} is missing from the Drizzle journal`);
    }
    if (file.hash !== row.hash) {
      throw new Error(`Applied migration ${row.created_at} was modified`);
    }
  }
}
