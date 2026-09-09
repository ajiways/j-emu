export class ResurrectUnavailableError extends Error {
  constructor(characterId: number) {
    super(`Hero ${characterId} cannot resurrect`);
    this.name = "ResurrectUnavailableError";
  }
}
