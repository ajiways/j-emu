export class ProgressionLimitError extends Error {
  constructor(exp: number) {
    super(`Experience ${exp} is outside the published progression curve`);
    this.name = "ProgressionLimitError";
  }
}
