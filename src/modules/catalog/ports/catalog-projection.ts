import type {
  AppearanceDocument,
  BootstrapChromeDocument,
  CommonConfBlock,
  HudDefaultsDocument,
  LevelBoundaryDocument,
  SkillDocument,
  WelcomeMessageDocument,
} from "../../content/domain/bootstrap-content.ts";
import type { ArtifactDocument, BotDocument } from "../../content/domain/content-document.ts";

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

export interface CatalogProjection {
  materialize(releaseId: string, documents: CatalogMaterialization): Promise<void>;
}
