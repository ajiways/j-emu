export class PartyDeniedError extends Error {
  readonly status = 2 as const;

  constructor(message: string) {
    super(message);
    this.name = "PartyDeniedError";
  }
}
