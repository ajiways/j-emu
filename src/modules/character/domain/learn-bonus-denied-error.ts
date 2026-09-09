export class LearnBonusDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LearnBonusDeniedError";
  }
}
