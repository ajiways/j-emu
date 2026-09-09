export class GhostHeroError extends Error {
  constructor(characterId: number, operation: string) {
    super(`Hero ${characterId} cannot ${operation} while ghosted`);
    this.name = "GhostHeroError";
  }
}
