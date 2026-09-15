import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import type { Clock } from "../../shared/kernel/clock.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import { CombatService } from "./application/combat-service.ts";
import { FinishedFightCleanup } from "./application/finished-fight-cleanup.ts";
import { FinishedFightList } from "./application/finished-fight-list.ts";
import { FinishedFightRecorder } from "./application/finished-fight-recorder.ts";
import type { HistoryWriteObserver } from "./application/history-write-observer.ts";
import { StructuredHistoryWriteObserver } from "./application/structured-history-write-observer.ts";
import type { BattleRules } from "./domain/battle-rules.ts";
import type { CombatDelay } from "./ports/combat-delay.ts";
import type { CombatWake } from "./ports/combat-wake.ts";
import type { FightSettlement } from "./ports/fight-settlement.ts";
import {
  FINISHED_FIGHT_CLEANUP_BATCH_SIZE,
  FINISHED_FIGHT_CLEANUP_INTERVAL_MS,
} from "./domain/finished-fight-retention.ts";
import type { RandomSource } from "./domain/random-source.ts";
import { SystemRandomSource } from "./domain/system-random-source.ts";
import { PostgresFightIdSource } from "./infrastructure/postgres-fight-id-source.ts";
import { PostgresFinishedFightStore } from "./infrastructure/postgres-finished-fight-store.ts";
import type { CombatPort } from "./ports/combat-port.ts";
import type { FightTerminalObserver } from "./ports/fight-terminal-observer.ts";

export class CombatModule {
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;

  private constructor(
    readonly combat: CombatPort,
    private readonly runtime: CombatService,
    private readonly cleanup: FinishedFightCleanup,
    private readonly historyWrites: HistoryWriteObserver,
  ) {}

  static create(input: {
    database: PostgresDatabase;
    rules: BattleRules;
    clock: Clock;
    delay: CombatDelay;
    random?: RandomSource;
    testBotStrength?: number;
  }): CombatModule {
    const database = requirePresent(input.database, "Combat module requires a database");
    const rules = requirePresent(input.rules, "Combat module requires battle rules");
    const clock = requirePresent(input.clock, "Combat module requires a clock");
    const delay = requirePresent(input.delay, "Combat module requires a combat delay");
    const history = new PostgresFinishedFightStore(database);
    const historyWrites = new StructuredHistoryWriteObserver((event) => {
      process.stderr.write(`${JSON.stringify(event)}\n`);
    });
    const runtime = new CombatService(
      new PostgresFightIdSource(database),
      input.random ?? new SystemRandomSource(),
      rules,
      clock,
      new FinishedFightRecorder(history, clock),
      historyWrites,
      delay,
      input.testBotStrength,
    );
    runtime.bindHistoryList(new FinishedFightList(history, clock));
    return new CombatModule(
      runtime,
      runtime,
      new FinishedFightCleanup(history, clock, FINISHED_FIGHT_CLEANUP_BATCH_SIZE),
      historyWrites,
    );
  }

  bindWake(wake: CombatWake): void {
    this.runtime.bindWake(wake);
  }

  bindSettlement(settlement: FightSettlement): void {
    this.runtime.bindSettlement(settlement);
  }

  bindTerminalObserver(observer: FightTerminalObserver): void {
    this.runtime.bindTerminalObserver(observer);
  }

  startHistoryCleanup(): void {
    if (this.cleanupTimer) throw new Error("Finished fight cleanup is already running");
    this.cleanupTimer = setInterval(() => {
      void this.cleanup.runBatch().catch((error) => {
        this.historyWrites.cleanupFailed(error instanceof Error ? error : new Error(String(error)));
      });
    }, FINISHED_FIGHT_CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.runtime.shutdown();
  }
}
