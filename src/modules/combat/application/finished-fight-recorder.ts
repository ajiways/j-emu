import type { Clock } from "../../../shared/kernel/clock.ts";
import {
  huntFinishedFightRecord,
  practiceFinishedFightRecord,
} from "../domain/finished-fight-record.ts";
import type { Battle } from "../domain/battle.ts";
import type { FinishedFightStore } from "../ports/finished-fight-store.ts";

export class FinishedFightRecorder {
  constructor(
    private readonly store: FinishedFightStore,
    private readonly clock: Clock,
  ) {}

  async record(battle: Battle, winnerTeam: 1 | 2): Promise<void> {
    if (battle.kind === "hunt") {
      await this.store.record(
        huntFinishedFightRecord({
          fightId: battle.id,
          ...battle.huntHistory(),
          timeout: battle.turnTimeoutSeconds,
          areaId: battle.areaId,
          winner: winnerTeam,
          startedAt: battle.startedAt,
          finishedAt: this.clock.now(),
        }),
      );
      return;
    }
    if (battle.kind !== "friendly-duel") return;
    await this.store.record(
      practiceFinishedFightRecord({
        fightId: battle.id,
        ...battle.practiceHistory(),
        timeout: battle.turnTimeoutSeconds,
        areaId: battle.areaId,
        winner: winnerTeam,
        startedAt: battle.startedAt,
        finishedAt: this.clock.now(),
      }),
    );
  }
}
