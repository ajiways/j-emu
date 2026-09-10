import type { PresenceService } from "../../world/application/presence-service.ts";
import type { LongPollCoordinator } from "./long-poll-coordinator.ts";

export class HuntAreaFanout {
  constructor(
    private readonly presence: PresenceService,
    private readonly longPoll: LongPollCoordinator,
  ) {}

  async wakeArea(areaId: string, instanceCopyId: number | null = null): Promise<void> {
    if (!areaId) throw new Error("Area id is required");
    const roster = await this.presence.listPopulation(areaId, instanceCopyId);
    for (const info of roster.population) {
      this.longPoll.wake(info.id);
    }
  }
}
