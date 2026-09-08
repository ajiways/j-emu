export class ProgressionContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProgressionContentError";
  }
}
