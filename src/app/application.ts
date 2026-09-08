import type { FastifyInstance } from "fastify";
import type { CharacterProgression } from "../modules/character/ports/character-progression.ts";

export class Application {
  constructor(
    readonly http: FastifyInstance,
    readonly characterProgression: CharacterProgression,
    private readonly closeRuntime: () => Promise<void>,
  ) {}

  async close(): Promise<void> {
    await this.closeRuntime();
  }
}
