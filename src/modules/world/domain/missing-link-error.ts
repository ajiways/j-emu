export class MissingLinkError extends Error {
  constructor() {
    super("некуда идти");
    this.name = "MissingLinkError";
  }
}
