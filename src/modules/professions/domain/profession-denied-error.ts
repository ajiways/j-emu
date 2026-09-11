export class ProfessionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfessionDeniedError";
  }
}
