export class MissingHpregError extends Error {
  constructor(characterId: number) {
    super(`HPREG total is missing or not positive for wounded character ${characterId}`);
    this.name = "MissingHpregError";
  }
}
