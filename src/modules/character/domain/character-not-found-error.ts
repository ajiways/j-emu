export class CharacterNotFoundError extends Error {
  constructor(characterId: number) {
    super(`Character ${characterId} was not found`);
    this.name = "CharacterNotFoundError";
  }
}
