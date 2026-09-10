export class TradeDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TradeDeniedError";
  }
}
