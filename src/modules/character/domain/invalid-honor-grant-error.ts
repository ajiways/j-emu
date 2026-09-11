export class InvalidHonorGrantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidHonorGrantError";
  }
}
