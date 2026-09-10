export class ProtocolError extends Error {
  constructor(
    readonly status: 2 | 4 | 203 | 204,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProtocolError";
  }
}

export function errorBlock(error: unknown): { status: 2 | 4 | 203 | 204; error: string } {
  if (error instanceof ProtocolError) return { status: error.status, error: error.message };
  if (error instanceof Error) return { status: 204, error: error.message };
  return { status: 204, error: "Unknown non-Error failure" };
}
