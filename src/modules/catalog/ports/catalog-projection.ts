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
  BonusDocument,
  BotDocument,
  ReputationTrackDocument,
  StoreLotDocument,
  StoreTypeDocument,
  UseScriptDocument,
} from "../../content/domain/content-document.ts";
import type { DungeonDocument } from "../../content/domain/content-dungeon.ts";
import type { BattlegroundDocument } from "../../content/domain/content-battleground.ts";

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
  bonuses: readonly BonusDocument[];
  useScripts: readonly UseScriptDocument[];
}>;

export type CatalogStoreMaterialization = Readonly<{
  storeTypes: readonly StoreTypeDocument[];
  storeLots: readonly StoreLotDocument[];
}>;

export type CatalogReputationMaterialization = Readonly<{
  reputationTracks: readonly ReputationTrackDocument[];
}>;

export type CatalogDungeonMaterialization = Readonly<{
  dungeons: readonly DungeonDocument[];
}>;

export type CatalogBattlegroundMaterialization = Readonly<{
  battlegrounds: readonly BattlegroundDocument[];
}>;

export interface CatalogProjection {
  materialize(releaseId: string, documents: CatalogMaterialization): Promise<void>;
  materializeStore(releaseId: string, documents: CatalogStoreMaterialization): Promise<void>;
  materializeReputation(
    releaseId: string,
    documents: CatalogReputationMaterialization,
  ): Promise<void>;
  materializeDungeons(releaseId: string, documents: CatalogDungeonMaterialization): Promise<void>;
  materializeBattlegrounds(
    releaseId: string,
    documents: CatalogBattlegroundMaterialization,
  ): Promise<void>;
}
