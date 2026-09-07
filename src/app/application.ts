import type { FastifyInstance } from "fastify";

export class Application {
  constructor(
    readonly http: FastifyInstance,
    private readonly closeRuntime: () => Promise<void>,
  ) {}

  async close(): Promise<void> {
    await this.closeRuntime();
  }
}
