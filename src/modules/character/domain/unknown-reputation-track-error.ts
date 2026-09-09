export class UnknownReputationTrackError extends Error {
  constructor(objectId: number) {
    super(`Reputation track ${objectId} is not published`);
    this.name = "UnknownReputationTrackError";
  }
}
