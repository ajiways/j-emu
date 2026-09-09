import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CompositionRoot } from "../../../src/app/composition-root.ts";
import type { Application } from "../../../src/app/application.ts";
import type { AppConfig } from "../../../src/app/config.ts";
import type { Clock } from "../../../src/shared/kernel/clock.ts";
import { publishDevelopmentContent } from "../../../src/infrastructure/postgres/publish-development-content.ts";
import { migrateDatabase } from "../../../src/infrastructure/postgres/migration-runner.ts";
import { writeClientStaticStubs } from "./client-static-stubs.ts";
import { requireTestDatabaseUrl } from "../postgres/test-database-url.ts";
import { FakeClock } from "../fake-clock.ts";
import { ManualCombatDelay } from "../fakes/manual-combat-delay.ts";
import { MutableClock } from "../fakes/mutable-clock.ts";
import type { RandomSource } from "../../../src/modules/combat/domain/random-source.ts";
import type { BattleRules } from "../../../src/modules/combat/domain/battle-rules.ts";

const testDatabaseUrl = requireTestDatabaseUrl();

export class ApplicationHarness {
  private readonly staticDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "j-emu-pub1-"));
  private applicationValue: Application | null = null;
  private readonly delay: ManualCombatDelay;
  private readonly clock: Clock;
  private readonly extras: Readonly<{
    lootRandom?: RandomSource;
    combatRandom?: RandomSource;
    combatRules?: Partial<BattleRules>;
  }>;

  constructor(
    clock?: Clock,
    delay = new ManualCombatDelay(),
    extras: Readonly<{
      lootRandom?: RandomSource;
      combatRandom?: RandomSource;
      combatRules?: Partial<BattleRules>;
    }> = {},
  ) {
    this.clock = clock ?? new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    this.delay = delay;
    this.extras = extras;
  }

  async start(): Promise<Application> {
    if (this.applicationValue) throw new Error("Application harness is already started");
    writeClientStaticStubs(this.staticDirectory);
    await migrateDatabase(testDatabaseUrl);
    await publishDevelopmentContent(
      testDatabaseUrl,
      path.resolve(process.cwd(), "content/playable-slice.json"),
    );
    this.applicationValue = await new CompositionRoot().build(
      this.config(),
      this.clock,
      this.delay,
      this.extras,
    );
    return this.applicationValue;
  }

  async restart(): Promise<Application> {
    if (!this.applicationValue) throw new Error("Application harness was not started");
    await this.applicationValue.close();
    this.applicationValue = await new CompositionRoot().build(
      this.config(),
      this.clock,
      this.delay,
      this.extras,
    );
    return this.applicationValue;
  }

  async elapseCombat(ms: number): Promise<void> {
    if (this.clock instanceof MutableClock) this.clock.advanceMs(ms);
    else if (this.clock instanceof FakeClock) this.clock.advanceSeconds(ms / 1000);
    else throw new Error("Application harness clock cannot elapse combat delays");
    await this.delay.fireDue(this.clock.now());
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
      fightProxyPath: "https://s1.jugger.ru/fproxy//;",
      fightProxyPort: 33120,
    };
  }
}
