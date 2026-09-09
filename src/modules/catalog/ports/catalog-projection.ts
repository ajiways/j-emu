import type {
  AppearanceDocument,
  BootstrapChromeDocument,
  CommonConfBlock,
  HudDefaultsDocument,
  LevelBoundaryDocument,
  SkillDocument,
  WelcomeMessageDocument,
} from "../../content/domain/bootstrap-content.ts";
import type {
  ArtifactDocument,
  BotDocument,
  ReputationTrackDocument,
  StoreLotDocument,
  StoreTypeDocument,
} from "../../content/domain/content-document.ts";

export type CatalogMaterialization = Readonly<{
  artifacts: readonly ArtifactDocument[];
  bots: readonly BotDocument[];
  skills: readonly SkillDocument[];
  levels: readonly LevelBoundaryDocument[];
  appearances: readonly AppearanceDocument[];
  hudDefaults: HudDefaultsDocument;
  chrome: BootstrapChromeDocument;
  commonConf: CommonConfBlock;
  welcomeMessage: WelcomeMessageDocument;
}>;

export type CatalogStoreMaterialization = Readonly<{
  storeTypes: readonly StoreTypeDocument[];
  storeLots: readonly StoreLotDocument[];
}>;

export type CatalogReputationMaterialization = Readonly<{
  reputationTracks: readonly ReputationTrackDocument[];
}>;

export interface CatalogProjection {
  materialize(releaseId: string, documents: CatalogMaterialization): Promise<void>;
  materializeStore(releaseId: string, documents: CatalogStoreMaterialization): Promise<void>;
  materializeReputation(
    releaseId: string,
    documents: CatalogReputationMaterialization,
  ): Promise<void>;
}
