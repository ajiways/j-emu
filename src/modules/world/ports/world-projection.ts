import type { AreaDocument, HuntSpawnDocument } from "../../content/domain/content-document.ts";

export interface WorldProjection {
  materialize(
    releaseId: string,
    areas: readonly AreaDocument[],
    huntSpawns: readonly HuntSpawnDocument[],
  ): Promise<void>;
}
