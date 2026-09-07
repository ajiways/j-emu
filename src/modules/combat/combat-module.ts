import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { SystemClock } from "../../shared/kernel/system-clock.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import { CombatService } from "./application/combat-service.ts";
import { FinishedFightCleanup } from "./application/finished-fight-cleanup.ts";
import { FinishedFightRecorder } from "./application/finished-fight-recorder.ts";
import type { HistoryWriteObserver } from "./application/history-write-observer.ts";
import { StructuredHistoryWriteObserver } from "./application/structured-history-write-observer.ts";
import type { BattleRules } from "./domain/battle.ts";
import {
  FINISHED_FIGHT_CLEANUP_BATCH_SIZE,
  FINISHED_FIGHT_CLEANUP_INTERVAL_MS,
} from "./domain/finished-fight-retention.ts";
import { SystemRandomSource } from "./domain/system-random-source.ts";
import { PostgresFightIdSource } from "./infrastructure/postgres-fight-id-source.ts";
import { PostgresFinishedFightStore } from "./infrastructure/postgres-finished-fight-store.ts";
import type { CombatPort } from "./ports/combat-port.ts";

export class CombatModule {
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;

  private constructor(
    readonly combat: CombatPort,
    private readonly runtime: CombatService,
    private readonly cleanup: FinishedFightCleanup,
    private readonly historyWrites: HistoryWriteObserver,
  ) {}

  static create(input: { database: PostgresDatabase; rules: BattleRules }): CombatModule {
    const database = requirePresent(input.database, "Combat module requires a database");
    const rules = requirePresent(input.rules, "Combat module requires battle rules");
    const clock = new SystemClock();
    const history = new PostgresFinishedFightStore(database);
    const historyWrites = new StructuredHistoryWriteObserver((event) => {
      process.stderr.write(`${JSON.stringify(event)}\n`);
    });
    const runtime = new CombatService(
      new PostgresFightIdSource(database),
      new SystemRandomSource(),
      rules,
      clock,
      new FinishedFightRecorder(history, clock),
      historyWrites,
    );
    return new CombatModule(
      runtime,
      runtime,
      new FinishedFightCleanup(history, clock, FINISHED_FIGHT_CLEANUP_BATCH_SIZE),
      historyWrites,
    );
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
