export class ContentValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Content bundle is invalid: ${issues.join("; ")}`);
    this.name = "ContentValidationError";
  }
}
