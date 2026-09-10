import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import type { Clock } from "../../shared/kernel/clock.ts";
import type { DelayScheduler } from "../../shared/kernel/delay-scheduler.ts";
import type { Catalog } from "../catalog/ports/catalog.ts";
import type { DungeonCatalog } from "../catalog/ports/dungeon-catalog.ts";
import type { HuntRandom } from "../world/ports/hunt-random.ts";
import { DungeonHuntWorld } from "./application/dungeon-hunt-world.ts";
import { InstanceService } from "./application/instance-service.ts";
import { PostgresInstanceRepository } from "./infrastructure/postgres-instance-repository.ts";

export class InstanceModule {
  private constructor(
    readonly service: InstanceService,
    readonly hunt: DungeonHuntWorld,
  ) {}

  static create(input: {
    database: PostgresDatabase;
    clock: Clock;
    delay: DelayScheduler;
    random: HuntRandom;
    dungeons: DungeonCatalog;
    catalog: Catalog;
  }): InstanceModule {
    const database = requirePresent(input.database, "Instance module requires a database");
    const clock = requirePresent(input.clock, "Instance module requires a clock");
    const delay = requirePresent(input.delay, "Instance module requires a delay scheduler");
    const random = requirePresent(input.random, "Instance module requires a random source");
    const dungeons = requirePresent(input.dungeons, "Instance module requires dungeon catalog");
    const catalog = requirePresent(input.catalog, "Instance module requires catalog");
    const service = new InstanceService(
      new PostgresInstanceRepository(database),
      dungeons,
      database,
      clock,
    );
    return new InstanceModule(
      service,
      new DungeonHuntWorld(service, catalog, clock, delay, random),
    );
  }

  async close(): Promise<void> {}
}
