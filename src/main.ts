import { CompositionRoot } from "./app/composition-root.ts";
import { loadConfig } from "./app/config.ts";
import { loadPackageEnv } from "./infrastructure/load-package-env.ts";

const root = loadPackageEnv(import.meta.url);
const config = loadConfig(process.env, root);
const application = await new CompositionRoot().build(config);

let stopping = false;
async function stop(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  application.http.log.info({ signal }, "shutdown_started");
  await application.close();
}

process.once("SIGINT", () => void stop("SIGINT"));
process.once("SIGTERM", () => void stop("SIGTERM"));

await application.http.listen({ host: config.host, port: config.port });
