export class MissingMpregError extends Error {
  constructor(characterId: number) {
    super(`MPREG total is missing or not positive for character ${characterId} short of mana`);
    this.name = "MissingMpregError";
  }
}
