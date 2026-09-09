export class SumReputationGrantError extends Error {
  constructor() {
    super("Cannot grant derived SUM reputation 36");
    this.name = "SumReputationGrantError";
  }
}
