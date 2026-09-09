export class InsufficientMoneyError extends Error {
  constructor(
    readonly currentMinor: number,
    readonly requestedMinor: number,
  ) {
    super(`Hero money ${currentMinor} is below debit ${requestedMinor}`);
    this.name = "InsufficientMoneyError";
  }
}
