export class TradeBagTakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TradeBagTakeError";
  }
}
