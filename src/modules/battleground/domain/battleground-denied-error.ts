export class BattlegroundDeniedError extends Error {
  readonly status = 2 as const;

  constructor(message: string) {
    super(message);
    this.name = "BattlegroundDeniedError";
  }
}
