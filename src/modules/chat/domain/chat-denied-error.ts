export class ChatDeniedError extends Error {
  constructor(
    readonly status: 2 | 203,
    message: string,
  ) {
    super(message);
    this.name = "ChatDeniedError";
  }
}
