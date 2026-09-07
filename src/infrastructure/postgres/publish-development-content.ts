import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadPackageEnv } from "../load-package-env.ts";
import { PostgresDatabase } from "./database.ts";
import { createPostgresContentPublication } from "../../modules/content/infrastructure/create-postgres-content-publication.ts";
import { loadContentBundleFile } from "../../modules/content/infrastructure/load-content-bundle-file.ts";

export async function publishDevelopmentContent(
  databaseUrl: string,
  bundleFile: string,
): Promise<void> {
  const bundle = loadContentBundleFile(bundleFile);
  const database = new PostgresDatabase(databaseUrl);
  try {
    const publication = createPostgresContentPublication(database);
    try {
      await publication.seed(bundle, bundleFile);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("already has content without a matching bootstrap import")) {
        throw error;
      }
      await publication.publish(bundle);
    }
  } finally {
    await database.close();
  }
}

const entry = process.argv[1];
if (entry && pathToFileURL(path.resolve(entry)).href === import.meta.url) {
  loadPackageEnv(import.meta.url);
  const databaseUrl = process.env.DATABASE_URL;
  const bundleFile = process.env.CONTENT_BUNDLE_FILE;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!bundleFile) throw new Error("CONTENT_BUNDLE_FILE is required");
  await publishDevelopmentContent(databaseUrl, bundleFile);
}
