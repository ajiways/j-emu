export class CatalogOperatorError extends Error {
  constructor(
    readonly status: 400 | 404,
    message: string,
  ) {
    super(message);
    this.name = "CatalogOperatorError";
  }
}
