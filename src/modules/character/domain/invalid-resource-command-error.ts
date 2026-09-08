export class InvalidResourceCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidResourceCommandError";
  }
}
