export class HonorGrantConflictError extends Error {
  constructor(operationId: string) {
    super(`Honor grant ${operationId} was reused with a different amount`);
    this.name = "HonorGrantConflictError";
  }
}
