import type { Area } from "../../src/modules/world/domain/area.ts";
import { HuntSpawnOverlay } from "../../src/modules/world/domain/hunt-spawn-overlay.ts";
import { HuntWanderRuntime } from "../../src/modules/world/domain/hunt-wander-runtime.ts";
import { WorldService } from "../../src/modules/world/domain/world-service.ts";
import type { WorldRepository } from "../../src/modules/world/ports/world-repository.ts";
import { ManualCombatDelay } from "./fakes/manual-combat-delay.ts";
import { MutableClock } from "./fakes/mutable-clock.ts";
import type { HuntRandom } from "../../src/modules/world/ports/hunt-random.ts";
import type { DelayScheduler } from "../../src/shared/kernel/delay-scheduler.ts";
import type { Clock } from "../../src/shared/kernel/clock.ts";

export class MinHuntRandom implements HuntRandom {
  integer(minInclusive: number, maxInclusive: number): number {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
      throw new Error("Random integer bounds must be integers");
    }
    if (maxInclusive < minInclusive) throw new Error("Invalid random range");
    return minInclusive;
  }

  unit(): number {
    return 0.5;
  }
}

export function worldServiceFor(
  area: Area,
  extras: Readonly<{
    clock?: Clock;
    delay?: DelayScheduler;
    random?: HuntRandom;
  }> = {},
): WorldService {
  return new WorldService(
    {
      findArea: async () => area,
      listHuntSpawns: async () => area.spawns.map((spawn) => ({ areaId: area.id, spawn })),
      listLinksFrom: async () => [],
      findLink: async () => null,
    } satisfies WorldRepository,
    new HuntSpawnOverlay(),
    new HuntWanderRuntime(
      extras.clock ?? new MutableClock(new Date("2026-09-07T12:00:00.000Z")),
      extras.delay ?? new ManualCombatDelay(),
      extras.random ?? new MinHuntRandom(),
    ),
  );
}
