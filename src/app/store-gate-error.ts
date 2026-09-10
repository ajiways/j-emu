export class StoreGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreGateError";
  }
}
