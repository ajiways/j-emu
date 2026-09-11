import type { FastifyInstance } from "fastify";
import type { CharacterProgression } from "../modules/character/ports/character-progression.ts";
import type { CharacterReputation } from "../modules/character/ports/character-reputation.ts";
import type { CharacterProfessions } from "../modules/character/ports/character-professions.ts";
import type { CharacterResources } from "../modules/character/ports/character-resources.ts";
import type { CharacterLocation } from "../modules/character/ports/character-location.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";

export class Application {
  constructor(
    readonly http: FastifyInstance,
    readonly characterProgression: CharacterProgression,
    readonly characterResources: CharacterResources,
    readonly characterReputation: CharacterReputation,
    readonly characterProfessions: CharacterProfessions,
    readonly characterLocation: CharacterLocation,
    readonly inventory: Pick<InventoryService, "grantToBag">,
    private readonly closeRuntime: () => Promise<void>,
  ) {}

  async close(): Promise<void> {
    await this.closeRuntime();
  }
}
