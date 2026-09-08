import type {
  AreaDocument,
  AreaLinkDocument,
  HuntSpawnDocument,
} from "../../content/domain/content-document.ts";

export interface WorldProjection {
  materialize(
    releaseId: string,
    areas: readonly AreaDocument[],
    areaLinks: readonly AreaLinkDocument[],
    huntSpawns: readonly HuntSpawnDocument[],
  ): Promise<void>;
}
