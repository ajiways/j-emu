import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadPackageEnv } from "../load-package-env.ts";
import { requireDevelopmentDatabaseUrl } from "./development-database-url.ts";
import { migrateDatabase } from "./migration-runner.ts";
import { publishDevelopmentContent } from "./publish-development-content.ts";
import { recreateDatabase } from "./recreate-database.ts";

export async function resetDevelopmentDatabase(input: {
  databaseUrl: string;
  bundleFile: string;
  testDatabaseUrl?: string;
}): Promise<void> {
  const databaseUrl = requireDevelopmentDatabaseUrl(input.databaseUrl, input.testDatabaseUrl);
  if (!input.bundleFile) throw new Error("CONTENT_BUNDLE_FILE is required");
  await recreateDatabase(databaseUrl, "recreate");
  await migrateDatabase(databaseUrl);
  await publishDevelopmentContent(databaseUrl, input.bundleFile);
}

const entry = process.argv[1];
if (entry && pathToFileURL(path.resolve(entry)).href === import.meta.url) {
  loadPackageEnv(import.meta.url);
  const bundleFile = process.env.CONTENT_BUNDLE_FILE;
  if (!bundleFile) throw new Error("CONTENT_BUNDLE_FILE is required");
  await resetDevelopmentDatabase({
    databaseUrl: requireDevelopmentDatabaseUrl(),
    bundleFile,
    ...(process.env.TEST_DATABASE_URL === undefined
      ? {}
      : { testDatabaseUrl: process.env.TEST_DATABASE_URL }),
  });
}
