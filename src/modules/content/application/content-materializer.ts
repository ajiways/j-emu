import type { CatalogProjection } from "../../catalog/ports/catalog-projection.ts";
import type { FarmStockProjection } from "../../professions/ports/farm-stock-projection.ts";
import type { QuestProjection } from "../../quests/ports/quest-projection.ts";
import type { WorldProjection } from "../../world/ports/world-projection.ts";
import type { ValidatedContentBundle } from "../domain/content-document.ts";

export class ContentMaterializer {
  constructor(
    private readonly catalog: CatalogProjection,
    private readonly world: WorldProjection,
    private readonly farmStocks: FarmStockProjection,
    private readonly quests: QuestProjection,
  ) {}

  async materialize(releaseId: string, validated: ValidatedContentBundle): Promise<void> {
    await this.catalog.materialize(releaseId, {
      artifacts: validated.artifacts,
      bots: validated.bots,
      skills: validated.skills,
      levels: validated.levels,
      appearances: validated.appearances,
      hudDefaults: validated.hudDefaults,
      chrome: validated.chrome,
      commonConf: validated.commonConf,
      welcomeMessage: validated.welcomeMessage,
      bonuses: validated.bonuses,
      useScripts: validated.useScripts,
    });
    await this.world.materialize(
      releaseId,
      validated.areas,
      validated.areaLinks,
      validated.huntSpawns,
    );
    await this.catalog.materializeStore(releaseId, {
      storeTypes: validated.storeTypes,
      storeLots: validated.storeLots,
    });
    await this.catalog.materializeReputation(releaseId, {
      reputationTracks: validated.reputationTracks,
    });
    await this.catalog.materializeDungeons(releaseId, {
      dungeons: validated.dungeons,
    });
    await this.catalog.materializeBattlegrounds(releaseId, {
      battlegrounds: validated.battlegrounds,
    });
    await this.catalog.materializeProfessions(releaseId, {
      professions: validated.professions,
    });
    await this.catalog.materializeFarms(releaseId, {
      assistantTypes: validated.assistantTypes,
      farmResources: validated.farmResources,
      areaFarms: validated.areaFarms,
    });
    await this.catalog.materializeCrafts(releaseId, {
      craftRecipes: validated.craftRecipes,
    });
    await this.farmStocks.materialize(validated.areaFarms);
    await this.quests.materialize(releaseId, {
      npcs: validated.npcs,
      quests: validated.quests,
      worldFacts: validated.worldFacts,
    });
  }
}
