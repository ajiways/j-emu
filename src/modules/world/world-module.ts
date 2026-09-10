import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import type { Clock } from "../../shared/kernel/clock.ts";
import type { DelayScheduler } from "../../shared/kernel/delay-scheduler.ts";
import { PostgresActiveContentRevision } from "../content/infrastructure/postgres-active-content-revision.ts";
import { HuntSpawnOverlay } from "./domain/hunt-spawn-overlay.ts";
import { HuntWanderRuntime } from "./domain/hunt-wander-runtime.ts";
import { WorldService } from "./domain/world-service.ts";
import { PostgresWorldRepository } from "./infrastructure/postgres-world-repository.ts";
import type { HuntRandom } from "./ports/hunt-random.ts";

export class WorldModule {
  private constructor(readonly service: WorldService) {}

  static async create(input: {
    database: PostgresDatabase;
    clock: Clock;
    delay: DelayScheduler;
    random: HuntRandom;
  }): Promise<WorldModule> {
    const database = requirePresent(input.database, "World module requires a database");
    const clock = requirePresent(input.clock, "World module requires a clock");
    const delay = requirePresent(input.delay, "World module requires a delay scheduler");
    const random = requirePresent(input.random, "World module requires a random source");
    const revision = new PostgresActiveContentRevision(database);
    await revision.requireId();
    const service = new WorldService(
      new PostgresWorldRepository(database, revision),
      new HuntSpawnOverlay(),
      new HuntWanderRuntime(clock, delay, random),
    );
    await service.startWander();
    return new WorldModule(service);
  }

  async close(): Promise<void> {}
}
