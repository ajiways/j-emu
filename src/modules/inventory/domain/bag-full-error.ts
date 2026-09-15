export class BagFullError extends Error {
  constructor(readonly characterId: number) {
    super(`Bag for hero ${characterId} is full`);
    this.name = "BagFullError";
  }
}
