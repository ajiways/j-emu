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

export interface CatalogProjection {
  materialize(releaseId: string, documents: CatalogMaterialization): Promise<void>;
  materializeStore(releaseId: string, documents: CatalogStoreMaterialization): Promise<void>;
}
