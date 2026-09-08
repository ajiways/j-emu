export class DropDeniedError extends Error {
  static readonly drop = 'Не удалось выполнить действие "Выбросить"!';
  static readonly sell = 'Не удалось выполнить действие "Продать"!';

  constructor(message: string) {
    super(message);
    this.name = "DropDeniedError";
  }

  static forIntent(intent: "drop" | "sell"): DropDeniedError {
    return new DropDeniedError(intent === "sell" ? DropDeniedError.sell : DropDeniedError.drop);
  }
}
