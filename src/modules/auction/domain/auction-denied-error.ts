export class AuctionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuctionDeniedError";
  }
}
