import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import type { CatalogCompatibility } from "../../catalog/ports/catalog-compatibility.ts";
import type { CatalogProjection } from "../../catalog/ports/catalog-projection.ts";
import type { WorldProjection } from "../../world/ports/world-projection.ts";
import type {
  ContentBundle,
  PublishedRelease,
  ValidatedContentBundle,
} from "../domain/content-document.ts";
import type { ContentStore } from "../ports/content-store.ts";
import type { ContentActivationCompatibility } from "./content-activation-compatibility.ts";
import type { ContentValidator } from "./content-validator.ts";

export class ContentPublicationService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly store: ContentStore,
    private readonly catalog: CatalogProjection,
    private readonly compatibility: CatalogCompatibility,
    private readonly world: WorldProjection,
    private readonly validator: ContentValidator,
    private readonly activation: ContentActivationCompatibility,
  ) {}

  async publish(bundle: ContentBundle): Promise<PublishedRelease> {
    const validated = this.validator.validate(bundle);
    return this.unitOfWork.run(async () => {
      const activeReleaseId = await this.store.lockPublication();
      const existing = await this.store.findByChecksum(validated.checksum);
      if (existing) {
        throw new Error(`Release checksum ${validated.checksum} already exists`);
      }
      await this.assertActivationCompatible(activeReleaseId, validated);
      return this.materializeAndActivate(validated);
    });
  }

  async seed(bundle: ContentBundle, source: string): Promise<PublishedRelease> {
    if (!source.trim()) throw new Error("Bootstrap import source is required");
    const validated = this.validator.validate(bundle);
    return this.unitOfWork.run(async () => {
      const activeReleaseId = await this.store.lockPublication();
      const bootstrapped = await this.store.findBootstrap(validated.checksum);
      if (bootstrapped) return bootstrapped;
      if (await this.store.hasAnyRelease()) {
        throw new Error("Database already has content without a matching bootstrap import");
      }
      await this.assertActivationCompatible(activeReleaseId, validated);
      const release = await this.materializeAndActivate(validated);
      await this.store.recordBootstrap(validated.checksum, release.id, source);
      return release;
    });
  }

  private async assertActivationCompatible(
    activeReleaseId: string | null,
    validated: ValidatedContentBundle,
  ): Promise<void> {
    if (!activeReleaseId) return;
    const previous = await this.compatibility.compatibilitySnapshot(activeReleaseId);
    this.activation.assertCompatible(previous, validated);
  }

  private async materializeAndActivate(
    validated: ValidatedContentBundle,
  ): Promise<PublishedRelease> {
    const release = await this.store.persistValidatedBundle(validated);
    await this.catalog.materialize(release.id, {
      artifacts: validated.artifacts,
      bots: validated.bots,
      skills: validated.skills,
      levels: validated.levels,
      appearances: validated.appearances,
      hudDefaults: validated.hudDefaults,
      chrome: validated.chrome,
      commonConf: validated.commonConf,
      welcomeMessage: validated.welcomeMessage,
    });
    await this.world.materialize(release.id, validated.areas, validated.huntSpawns);
    await this.store.activate(release.id);
    return release;
  }
}
