import type { FastifyInstance } from "fastify";
import type { CharacterProgression } from "../modules/character/ports/character-progression.ts";
import type { CharacterResources } from "../modules/character/ports/character-resources.ts";

export class Application {
  constructor(
    readonly http: FastifyInstance,
    readonly characterProgression: CharacterProgression,
    readonly characterResources: CharacterResources,
    private readonly closeRuntime: () => Promise<void>,
  ) {}

  async close(): Promise<void> {
    await this.closeRuntime();
  }
}
