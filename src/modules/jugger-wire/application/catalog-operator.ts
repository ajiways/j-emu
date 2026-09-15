import type { ArtifactBrief } from "../../catalog/domain/artifact-brief.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import { CatalogOperatorError } from "./catalog-operator-error.ts";

const SEARCH_LIMIT = 20;

export class CatalogOperator {
  constructor(private readonly catalog: Pick<Catalog, "artifact" | "searchArtifacts">) {}

  async list(query: {
    q?: string;
    ids?: readonly number[];
  }): Promise<{ artifacts: readonly ArtifactBrief[] }> {
    if (query.ids !== undefined) {
      const artifacts = await this.catalog.searchArtifacts({
        text: "",
        limit: query.ids.length,
        ids: query.ids,
      });
      return { artifacts };
    }
    const artifacts = await this.catalog.searchArtifacts({
      text: query.q ?? "",
      limit: SEARCH_LIMIT,
    });
    return { artifacts };
  }

  async one(id: number): Promise<ArtifactBrief> {
    const found = await this.catalog.artifact(id);
    if (!found) throw new CatalogOperatorError(404, `Artifact ${id} was not found`);
    return {
      id: found.id,
      title: found.title,
      picture: found.picture,
      kindId: found.kindId,
      typeId: found.typeId,
    };
  }
}
