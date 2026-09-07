export class FinishedFightConflictError extends Error {
  constructor(readonly fightId: bigint) {
    super(`Finished fight ${fightId} already exists with a different result`);
    this.name = "FinishedFightConflictError";
  }
}
