export class UnknownProfessionError extends Error {
  constructor(professionId: number) {
    super(`Profession ${professionId} is not in the active catalog`);
    this.name = "UnknownProfessionError";
  }
}
