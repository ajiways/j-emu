import { loadPackageEnv } from "../load-package-env.ts";
import { migrateDatabase } from "./migration-runner.ts";

loadPackageEnv(import.meta.url);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

await migrateDatabase(databaseUrl);
