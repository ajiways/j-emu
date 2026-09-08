export class ExperienceGrantConflictError extends Error {
  constructor(operationId: string) {
    super(`Experience grant ${operationId} was reused with a different amount`);
    this.name = "ExperienceGrantConflictError";
  }
}
