export class StoreDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreDeniedError";
  }
}
