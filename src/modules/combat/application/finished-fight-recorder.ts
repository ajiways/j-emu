import type { Clock } from "../../../shared/kernel/clock.ts";
import { huntFinishedFightRecord } from "../domain/finished-fight-record.ts";
import type { Battle } from "../domain/battle.ts";
import type { FinishedFightStore } from "../ports/finished-fight-store.ts";

export class FinishedFightRecorder {
  constructor(
    private readonly store: FinishedFightStore,
    private readonly clock: Clock,
  ) {}

  async record(battle: Battle, winnerTeam: 1 | 2): Promise<void> {
    await this.store.record(
      huntFinishedFightRecord({
        fightId: battle.id,
        accountId: battle.accountId,
        heroId: battle.heroId,
        heroNick: battle.heroNick,
        heroLevel: battle.heroLevel,
        heroKind: battle.heroKind,
        botId: battle.botId,
        botNick: battle.botNick,
        botLevel: battle.botLevel,
        timeout: battle.turnTimeoutSeconds,
        areaId: battle.areaId,
        winner: winnerTeam,
        startedAt: battle.startedAt,
        finishedAt: this.clock.now(),
      }),
    );
  }
}
