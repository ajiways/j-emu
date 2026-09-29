export type FightLevelUp = Readonly<{ accountId: number; levelBefore: number; levelAfter: number }>;

export class FightLevelUpLog {
  private readonly byFight = new Map<string, FightLevelUp[]>();

  note(fightId: string, entry: FightLevelUp): void {
    const list = this.byFight.get(fightId) ?? [];
    list.push(entry);
    this.byFight.set(fightId, list);
  }

  take(fightId: string): readonly FightLevelUp[] {
    const list = this.byFight.get(fightId) ?? [];
    this.byFight.delete(fightId);
    return list;
  }
}
