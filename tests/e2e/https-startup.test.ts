import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CompositionRoot } from "../../src/app/composition-root.ts";
import type { Application } from "../../src/app/application.ts";
import type { AppConfig } from "../../src/app/config.ts";
import { publishDevelopmentContent } from "../../src/infrastructure/postgres/publish-development-content.ts";
import { migrateDatabase } from "../../src/infrastructure/postgres/migration-runner.ts";
import { writeClientStaticStubs } from "../support/harness/client-static-stubs.ts";
import { requireTestDatabaseUrl } from "../support/postgres/test-database-url.ts";

const tlsFixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../support/tls");
const testDatabaseUrl = requireTestDatabaseUrl();

describe("HTTPS startup", () => {
  let application: Application | undefined;
  let staticDirectory: string | undefined;

  beforeEach(async () => {
    staticDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "j-emu-https-"));
    writeClientStaticStubs(staticDirectory);
    await migrateDatabase(testDatabaseUrl);
    await publishDevelopmentContent(
      testDatabaseUrl,
      path.resolve(process.cwd(), "content/playable-slice.json"),
    );
    application = await new CompositionRoot().build(httpsConfig(staticDirectory));
  });

  afterEach(async () => {
    if (application) await application.close();
    application = undefined;
    if (staticDirectory) fs.rmSync(staticDirectory, { recursive: true, force: true });
    staticDirectory = undefined;
  });

  it("listens with legacy TLS and serves /login", async () => {
    if (!application) throw new Error("HTTPS application was not started");
    await application.http.listen({ host: "127.0.0.1", port: 0 });
    const address = application.http.server.address();
    if (!address || typeof address === "string") throw new Error("TLS server has no port");
    const body = await getLoginHtml(address.port);
    expect(body).toContain("Джаггернаут");
    expect(body).toContain('action="/login"');
  });
});

function httpsConfig(pub1Dir: string): AppConfig {
  return {
    host: "127.0.0.1",
    port: 18443,
    httpOnly: false,
    databaseUrl: testDatabaseUrl,
    pub1Dir,
    certsDir: tlsFixtureDir,
    esrvPollMs: 1,
    fproxyPollMs: 1,
    logLevel: "silent",
    gamePolicyFile: path.resolve(process.cwd(), "config/development.json"),
    fightProxyHost: "s1.jugger.ru",
    fightProxyPath: "https://s1.jugger.ru/fproxy//;",
    fightProxyPort: 33120,
  };
}

function getLoginHtml(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(
        {
          hostname: "127.0.0.1",
          port,
          path: "/login",
          rejectUnauthorized: false,
          servername: "s1.jugger.ru",
        },
        (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`/login returned ${response.statusCode}`));
            return;
          }
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => chunks.push(chunk as Buffer));
          response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        },
      )
      .on("error", reject);
  });
}
