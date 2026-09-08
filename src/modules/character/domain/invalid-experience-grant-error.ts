export class InvalidExperienceGrantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidExperienceGrantError";
  }
}
