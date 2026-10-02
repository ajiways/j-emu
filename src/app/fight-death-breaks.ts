import { FINISHED_FIGHT_RETENTION_MS } from "../modules/combat/domain/finished-fight-retention.ts";
import type { DeathDurabilityBreak } from "../modules/inventory/domain/apply-death-durability.ts";
import type { Clock } from "../shared/kernel/clock.ts";
import { TtlMap } from "../shared/kernel/ttl-map.ts";

/** The items a defeat broke, by fight and account, until the chat line about them is sent. */
export class FightDeathBreaks {
  private readonly rows: TtlMap<string, Map<number, readonly DeathDurabilityBreak[]>>;

  constructor(clock: Clock) {
    this.rows = new TtlMap(FINISHED_FIGHT_RETENTION_MS, clock);
  }

  remember(fightId: string, accountId: number, breaks: readonly DeathDurabilityBreak[]): void {
    if (breaks.length === 0) return;
    const row = this.rows.get(fightId) ?? new Map();
    if (row.has(accountId)) {
      throw new Error(`Death breaks for fight ${fightId} account ${accountId} already recorded`);
    }
    row.set(accountId, breaks);
    this.rows.set(fightId, row);
  }

  takeFight(fightId: string): ReadonlyMap<number, readonly DeathDurabilityBreak[]> {
    const row = this.rows.get(fightId) ?? new Map();
    this.rows.delete(fightId);
    return row;
  }

  takeAccount(fightId: string, accountId: number): readonly DeathDurabilityBreak[] {
    const row = this.rows.get(fightId);
    if (!row) return [];
    const breaks = row.get(accountId) ?? [];
    row.delete(accountId);
    if (row.size === 0) this.rows.delete(fightId);
    return breaks;
  }
}
