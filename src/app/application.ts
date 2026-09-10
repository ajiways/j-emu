import type { FastifyInstance } from "fastify";
import type { CharacterProgression } from "../modules/character/ports/character-progression.ts";
import type { CharacterReputation } from "../modules/character/ports/character-reputation.ts";
import type { CharacterProfessions } from "../modules/character/ports/character-professions.ts";
import type { CharacterResources } from "../modules/character/ports/character-resources.ts";
import type { CharacterLocation } from "../modules/character/ports/character-location.ts";

export class Application {
  constructor(
    readonly http: FastifyInstance,
    readonly characterProgression: CharacterProgression,
    readonly characterResources: CharacterResources,
    readonly characterReputation: CharacterReputation,
    readonly characterProfessions: CharacterProfessions,
    readonly characterLocation: CharacterLocation,
    private readonly closeRuntime: () => Promise<void>,
  ) {}

  async close(): Promise<void> {
    await this.closeRuntime();
  }
}
