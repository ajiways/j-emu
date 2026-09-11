export type PvpHonorShare = Readonly<{
  characterId: number;
  accountId: number;
  honor: number;
  dmg: number;
  rank: string;
}>;

export class PvpFightHonorCache {
  private readonly shares = new Map<string, readonly PvpHonorShare[]>();

  remember(fightId: string, shares: readonly PvpHonorShare[]): void {
    if (!fightId) throw new Error("PvP honor fight id is required");
    if (shares.length !== 2) {
      throw new Error(`PvP honor cache for ${fightId} must cover both humans`);
    }
    const existing = this.shares.get(fightId);
    if (existing) return;
    this.shares.set(fightId, shares);
  }

  sharesFor(fightId: string): readonly PvpHonorShare[] {
    const shares = this.shares.get(fightId);
    if (!shares) throw new Error(`PvP honor cache for ${fightId} is missing`);
    return shares;
  }
}
