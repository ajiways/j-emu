export class InsufficientDiamondsError extends Error {
  constructor(
    readonly currentMinor: number,
    readonly requestedMinor: number,
  ) {
    super(`Hero diamonds ${currentMinor} are below debit ${requestedMinor}`);
    this.name = "InsufficientDiamondsError";
  }
}
