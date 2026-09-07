import type { ArtifactDocument, BotDocument } from "../../content/domain/content-document.ts";

export interface CatalogProjection {
  materialize(
    releaseId: string,
    artifacts: readonly ArtifactDocument[],
    bots: readonly BotDocument[],
  ): Promise<void>;
}
