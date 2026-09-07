export class MonotonicFightIdSource {
  constructor(
    private fightId: number,
    private participantId: number,
  ) {
    if (fightId < 1 || participantId < 1) throw new Error("Fight id seeds must be positive");
  }

  async nextFightId(): Promise<string> {
    const value = String(this.fightId);
    this.fightId += 1;
    return value;
  }

  async nextParticipantId(): Promise<bigint> {
    const value = this.participantId;
    this.participantId += 1;
    return BigInt(value);
  }
}
