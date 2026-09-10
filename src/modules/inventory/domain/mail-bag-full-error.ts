export class MailBagFullError extends Error {
  constructor() {
    super("в рюкзаке нет места");
    this.name = "MailBagFullError";
  }
}
