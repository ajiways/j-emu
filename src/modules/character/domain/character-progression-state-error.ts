export class CharacterProgressionStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CharacterProgressionStateError";
  }
}
