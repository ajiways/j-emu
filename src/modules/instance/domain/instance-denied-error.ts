export class InstanceDeniedError extends Error {
  constructor(
    readonly status: 2 | 204,
    message: string,
  ) {
    super(message);
    this.name = "InstanceDeniedError";
  }
}
