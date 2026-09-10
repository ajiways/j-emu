export class MailDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailDeniedError";
  }
}
