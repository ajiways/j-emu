import { CompositionRoot } from "../src/app/composition-root.ts";
import { loadConfig } from "../src/app/config.ts";
import { loadPackageEnv } from "../src/infrastructure/load-package-env.ts";
import { TlsCredentials } from "../src/modules/jugger-wire/infrastructure/http/tls-credentials.ts";

const root = loadPackageEnv(import.meta.url);
const config = loadConfig(process.env, root);
if (config.httpOnly) {
  throw new Error("npm run start:https requires HTTP_ONLY=0");
}
if (config.host !== "0.0.0.0") {
  throw new Error("npm run start:https requires HOST=0.0.0.0");
}
if (config.port !== 443) {
  throw new Error("npm run start:https requires PORT=443");
}
TlsCredentials.load(config.certsDir);

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
application.http.log.info(
  { certsDir: config.certsDir },
  "https listening on https://0.0.0.0:443 — install certs/cert.pem as a trusted root on the client OS",
);
