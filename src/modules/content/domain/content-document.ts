import type {
  AppearanceDocument,
  BootstrapChromeDocument,
  CommonConfBlock,
  HudDefaultsDocument,
  LevelBoundaryDocument,
  SkillDocument,
  WelcomeMessageDocument,
} from "./bootstrap-content.ts";
import type { DungeonDocument } from "./content-dungeon.ts";
import type { BattlegroundDocument } from "./content-battleground.ts";
import type { ProfessionDocument } from "./content-profession.ts";
import type {
  AreaFarmDocument,
  AssistantTypeDocument,
  FarmResourceDocument,
} from "./content-farm.ts";
import type { CraftRecipeDocument } from "./content-craft.ts";
import type {
  AreaDocument,
  AreaLinkDocument,
  ArtifactDocument,
  BonusDocument,
  BotDocument,
  HuntSpawnDocument,
  ReputationTrackDocument,
  StoreLotDocument,
  StoreTypeDocument,
  UseScriptDocument,
} from "./content-playable-entities.ts";
import type { NpcDocument, QuestDocument, WorldFactDocument } from "./content-quest.ts";

export type {
  AreaDocument,
  AreaLinkDocument,
  ArtifactDocument,
  BonusDocument,
  BotDocument,
  HuntSpawnDocument,
  ReputationTrackDocument,
  StoreLotDocument,
  StoreTypeDocument,
  UseScriptDocument,
} from "./content-playable-entities.ts";

export const PLAYABLE_SLICE_SCHEMA_VERSION = "playable-slice/v31";
export const CONTENT_VALIDATOR_VERSION = "31";

type PlayableSliceDocuments = {
  artifacts: readonly ArtifactDocument[];
  bots: readonly BotDocument[];
  areas: readonly AreaDocument[];
  areaLinks: readonly AreaLinkDocument[];
  huntSpawns: readonly HuntSpawnDocument[];
  dungeons: readonly DungeonDocument[];
  battlegrounds: readonly BattlegroundDocument[];
  storeTypes: readonly StoreTypeDocument[];
  storeLots: readonly StoreLotDocument[];
  reputationTracks: readonly ReputationTrackDocument[];
  professions: readonly ProfessionDocument[];
  assistantTypes: readonly AssistantTypeDocument[];
  farmResources: readonly FarmResourceDocument[];
  areaFarms: readonly AreaFarmDocument[];
  craftRecipes: readonly CraftRecipeDocument[];
  npcs: readonly NpcDocument[];
  quests: readonly QuestDocument[];
  worldFacts: readonly WorldFactDocument[];
  bonuses: readonly BonusDocument[];
  useScripts: readonly UseScriptDocument[];
  skills: readonly SkillDocument[];
  levels: readonly LevelBoundaryDocument[];
  appearances: readonly AppearanceDocument[];
  hudDefaults: HudDefaultsDocument;
  chrome: BootstrapChromeDocument;
  commonConf: CommonConfBlock;
  welcomeMessage: WelcomeMessageDocument;
};

export type ContentBundle = Readonly<{ schemaVersion: string } & PlayableSliceDocuments>;

export type ContentEntry = Readonly<{
  type:
    | "artifact"
    | "bot"
    | "area"
    | "area_link"
    | "hunt_spawn"
    | "dungeon"
    | "battleground"
    | "store_type"
    | "store_lot"
    | "reputation_track"
    | "profession"
    | "assistant_type"
    | "farm_resource"
    | "area_farm"
    | "craft_recipe"
    | "npc"
    | "quest"
    | "world_fact"
    | "bonus"
    | "use_script"
    | "skill"
    | "level"
    | "appearance"
    | "hud_defaults"
    | "chrome"
    | "common_conf"
    | "welcome_message";
  key: string;
  digest: string;
  document:
    | ArtifactDocument
    | BotDocument
    | AreaDocument
    | AreaLinkDocument
    | HuntSpawnDocument
    | DungeonDocument
    | BattlegroundDocument
    | StoreTypeDocument
    | StoreLotDocument
    | ReputationTrackDocument
    | ProfessionDocument
    | AssistantTypeDocument
    | FarmResourceDocument
    | AreaFarmDocument
    | CraftRecipeDocument
    | NpcDocument
    | QuestDocument
    | WorldFactDocument
    | BonusDocument
    | UseScriptDocument
    | SkillDocument
    | LevelBoundaryDocument
    | AppearanceDocument
    | HudDefaultsDocument
    | BootstrapChromeDocument
    | CommonConfBlock
    | WelcomeMessageDocument;
}>;

export type ValidatedContentBundle = Readonly<
  {
    schemaVersion: string;
    validatorVersion: string;
    checksum: string;
    entries: readonly ContentEntry[];
  } & PlayableSliceDocuments
>;

export type PublishedRelease = Readonly<{
  id: string;
  version: number;
  checksum: string;
}>;
