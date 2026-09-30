import { requireTestDatabaseUrl } from "./test-database-url.ts";
import { currentWorkerId, workerDatabaseUrl } from "./worker-database.ts";

// Runs before each e2e file imports the harness: point it at this worker's own database.
process.env.TEST_DATABASE_URL = workerDatabaseUrl(requireTestDatabaseUrl(), currentWorkerId());
