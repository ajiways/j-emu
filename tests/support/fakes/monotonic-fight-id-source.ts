export class MonotonicFightIdSource {
  constructor(private fightId: number) {
    if (fightId < 1) throw new Error("Fight id seed must be positive");
  }

  async nextFightId(): Promise<string> {
    const value = String(this.fightId);
    this.fightId += 1;
    return value;
  }
}
