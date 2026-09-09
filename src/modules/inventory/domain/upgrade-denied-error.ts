export class UpgradeDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpgradeDeniedError";
  }
}
