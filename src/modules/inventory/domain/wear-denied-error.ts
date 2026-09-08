export class WearDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WearDeniedError";
  }
}
