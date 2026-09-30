import { postgresDatabaseName } from "../../../src/infrastructure/postgres/postgres-database-name.ts";
import { requireTestDatabaseUrl } from "./test-database-url.ts";

/** `jemu_test` → `jemu_w3_test`: every e2e worker owns a database cloned from the template. */
export function workerDatabaseUrl(templateUrl: string, workerId: number): string {
  requireTestDatabaseUrl(templateUrl);
  if (!Number.isInteger(workerId) || workerId < 1) throw new Error("Worker id must be positive");
  const name = postgresDatabaseName(templateUrl);
  const url = new URL(templateUrl);
  url.pathname = `/${name.slice(0, -"_test".length)}_w${workerId}_test`;
  return url.toString();
}

/** Vitest numbers pool workers from 1; a missing id means the file did not run in a worker. */
export function currentWorkerId(): number {
  const raw = process.env.VITEST_POOL_ID;
  if (!raw) throw new Error("VITEST_POOL_ID is required to pick the e2e worker database");
  return Number(raw);
}
