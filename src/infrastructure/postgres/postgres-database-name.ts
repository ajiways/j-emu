export function postgresDatabaseName(databaseUrl: string): string {
  if (!databaseUrl) throw new Error("Database URL is required");
  const name = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
  if (!name) throw new Error("Database URL has no database name");
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Database name contains unsupported characters: ${name}`);
  }
  if (name === "postgres") {
    throw new Error("Refusing to operate on the postgres maintenance database");
  }
  return name;
}
