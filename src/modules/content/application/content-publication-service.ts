import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import type { CatalogProjection } from "../../catalog/ports/catalog-projection.ts";
import type { WorldProjection } from "../../world/ports/world-projection.ts";
import type {
  ContentBundle,
  PublishedRelease,
  ValidatedContentBundle,
} from "../domain/content-document.ts";
import type { ContentStore } from "../ports/content-store.ts";
import type { ContentValidator } from "./content-validator.ts";

export class ContentPublicationService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly store: ContentStore,
    private readonly catalog: CatalogProjection,
    private readonly world: WorldProjection,
    private readonly validator: ContentValidator,
  ) {}

  async publish(bundle: ContentBundle): Promise<PublishedRelease> {
    const validated = this.validator.validate(bundle);
    return this.unitOfWork.run(async () => {
      await this.store.lockPublication();
      const existing = await this.store.findByChecksum(validated.checksum);
      if (existing) {
        throw new Error(`Release checksum ${validated.checksum} already exists`);
      }
      return this.materializeAndActivate(validated);
    });
  }

  async seed(bundle: ContentBundle, source: string): Promise<PublishedRelease> {
    if (!source.trim()) throw new Error("Bootstrap import source is required");
    const validated = this.validator.validate(bundle);
    return this.unitOfWork.run(async () => {
      await this.store.lockPublication();
      const bootstrapped = await this.store.findBootstrap(validated.checksum);
      if (bootstrapped) return bootstrapped;
      if (await this.store.hasAnyRelease()) {
        throw new Error("Database already has content without a matching bootstrap import");
      }
      const release = await this.materializeAndActivate(validated);
      await this.store.recordBootstrap(validated.checksum, release.id, source);
      return release;
    });
  }

  private async materializeAndActivate(
    validated: ValidatedContentBundle,
  ): Promise<PublishedRelease> {
    const release = await this.store.persistValidatedBundle(validated);
    await this.catalog.materialize(release.id, validated.artifacts, validated.bots);
    await this.world.materialize(release.id, validated.areas, validated.huntSpawns);
    await this.store.activate(release.id);
    return release;
  }
}
