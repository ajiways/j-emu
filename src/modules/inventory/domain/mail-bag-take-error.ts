export class MailBagTakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailBagTakeError";
  }
}
