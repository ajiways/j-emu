export type FightProgressUp =
  | Readonly<{ kind: "level"; accountId: number; before: number; after: number }>
  | Readonly<{ kind: "rank"; accountId: number; before: number; after: number; heroLevel: number }>;

export class FightProgressLog {
  private readonly byFight = new Map<string, FightProgressUp[]>();

  note(fightId: string, entry: FightProgressUp): void {
    const list = this.byFight.get(fightId) ?? [];
    list.push(entry);
    this.byFight.set(fightId, list);
  }

  take(fightId: string): readonly FightProgressUp[] {
    const list = this.byFight.get(fightId) ?? [];
    this.byFight.delete(fightId);
    return list;
  }
}
