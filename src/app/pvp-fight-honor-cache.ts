import { FINISHED_FIGHT_RETENTION_MS } from "../modules/combat/domain/finished-fight-retention.ts";
import type { Clock } from "../shared/kernel/clock.ts";
import { TtlMap } from "../shared/kernel/ttl-map.ts";

export type PvpHonorShare = Readonly<{
  characterId: number;
  accountId: number;
  honor: number;
  dmg: number;
  rank: string;
}>;

export class PvpFightHonorCache {
  private readonly shares: TtlMap<string, readonly PvpHonorShare[]>;

  constructor(clock: Clock) {
    this.shares = new TtlMap(FINISHED_FIGHT_RETENTION_MS, clock);
  }

  remember(fightId: string, shares: readonly PvpHonorShare[]): void {
    if (!fightId) throw new Error("PvP honor fight id is required");
    if (shares.length === 0) throw new Error(`PvP honor cache for ${fightId} has no humans`);
    if (this.shares.has(fightId)) return;
    this.shares.set(fightId, shares);
  }

  /** What each human earned in the fight; a fight that paid no heroism has no entry. */
  honorByAccount(fightId: string): ReadonlyMap<number, number> {
    return new Map((this.shares.get(fightId) ?? []).map((share) => [share.accountId, share.honor]));
  }

  sharesFor(fightId: string): readonly PvpHonorShare[] {
    const shares = this.shares.get(fightId);
    if (!shares) throw new Error(`PvP honor cache for ${fightId} is missing`);
    return shares;
  }
}
