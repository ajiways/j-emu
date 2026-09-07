import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CompositionRoot } from "../../../src/app/composition-root.ts";
import type { Application } from "../../../src/app/application.ts";
import type { AppConfig } from "../../../src/app/config.ts";
import { publishDevelopmentContent } from "../../../src/infrastructure/postgres/publish-development-content.ts";
import { migrateDatabase } from "../../../src/infrastructure/postgres/migration-runner.ts";
import { requireTestDatabaseUrl } from "../postgres/test-database-url.ts";

const testDatabaseUrl = requireTestDatabaseUrl();

export class ApplicationHarness {
  private readonly staticDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "j-emu-pub1-"));
  private applicationValue: Application | null = null;

  async start(): Promise<Application> {
    if (this.applicationValue) throw new Error("Application harness is already started");
    await migrateDatabase(testDatabaseUrl);
    await publishDevelopmentContent(
      testDatabaseUrl,
      path.resolve(process.cwd(), "content/playable-slice.json"),
    );
    this.applicationValue = await new CompositionRoot().build(this.config());
    return this.applicationValue;
  }

  async restart(): Promise<Application> {
    if (!this.applicationValue) throw new Error("Application harness was not started");
    await this.applicationValue.close();
    this.applicationValue = await new CompositionRoot().build(this.config());
    return this.applicationValue;
  }

  async stop(): Promise<void> {
    if (!this.applicationValue) throw new Error("Application harness was not started");
    await this.applicationValue.close();
    this.applicationValue = null;
    fs.rmSync(this.staticDirectory, { recursive: true });
  }

  private config(): AppConfig {
    return {
      host: "127.0.0.1",
      port: 18080,
      httpOnly: true,
      databaseUrl: testDatabaseUrl,
      pub1Dir: this.staticDirectory,
      certsDir: path.join(this.staticDirectory, "certs-not-used"),
      esrvPollMs: 1,
      fproxyPollMs: 1,
      logLevel: "silent",
      gamePolicyFile: path.resolve(process.cwd(), "config/development.json"),
      fightProxyHost: "s1.jugger.ru",
      fightProxyPath: "/fproxy/",
      fightProxyPort: 33120,
    };
  }
}
