import {
  PLAYABLE_SLICE_SCHEMA_VERSION,
  type ContentBundle,
  type ContentEntry,
} from "./content-document.ts";
import { type ContentType, parseDraftDocument } from "./parse-content-document.ts";
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

export type CandidateDocument = Readonly<{
  contentType: ContentType;
  contentKey: string;
  document: unknown;
}>;

export function assembleContentBundle(entries: readonly CandidateDocument[]): ContentBundle {
  if (entries.length === 0) throw new Error("Candidate has no entries");
  return {
    schemaVersion: PLAYABLE_SLICE_SCHEMA_VERSION,
    artifacts: takeArray<ArtifactDocument>("artifact", entries),
    bots: takeArray<BotDocument>("bot", entries),
    areas: takeArray<AreaDocument>("area", entries),
    areaLinks: takeArray<AreaLinkDocument>("area_link", entries),
    huntSpawns: takeArray<HuntSpawnDocument>("hunt_spawn", entries),
    dungeons: takeArray<DungeonDocument>("dungeon", entries),
    battlegrounds: takeArray<BattlegroundDocument>("battleground", entries),
    storeTypes: takeArray<StoreTypeDocument>("store_type", entries),
    storeLots: takeArray<StoreLotDocument>("store_lot", entries),
    reputationTracks: takeArray<ReputationTrackDocument>("reputation_track", entries),
    professions: takeArray<ProfessionDocument>("profession", entries),
    assistantTypes: takeArray<AssistantTypeDocument>("assistant_type", entries),
    farmResources: takeArray<FarmResourceDocument>("farm_resource", entries),
    areaFarms: takeArray<AreaFarmDocument>("area_farm", entries),
    craftRecipes: takeArray<CraftRecipeDocument>("craft_recipe", entries),
    npcs: takeArray<NpcDocument>("npc", entries),
    quests: takeArray<QuestDocument>("quest", entries),
    worldFacts: takeArray<WorldFactDocument>("world_fact", entries),
    bonuses: takeArray<BonusDocument>("bonus", entries),
    useScripts: takeArray<UseScriptDocument>("use_script", entries),
    skills: takeArray<SkillDocument>("skill", entries),
    levels: takeArray<LevelBoundaryDocument>("level", entries),
    appearances: takeArray<AppearanceDocument>("appearance", entries),
    hudDefaults: takeSingleton<HudDefaultsDocument>("hud_defaults", entries),
    chrome: takeSingleton<BootstrapChromeDocument>("chrome", entries),
    commonConf: takeSingleton<CommonConfBlock>("common_conf", entries),
    welcomeMessage: takeSingleton<WelcomeMessageDocument>("welcome_message", entries),
  };
}

function takeArray<T extends ContentEntry["document"]>(
  contentType: ContentType,
  entries: readonly CandidateDocument[],
): T[] {
  const rows = [];
  for (const entry of entries) {
    if (entry.contentType !== contentType) continue;
    rows.push(parseDraftDocument(contentType, entry.document) as T);
  }
  return rows;
}

function takeSingleton<T extends ContentEntry["document"]>(
  contentType: ContentType,
  entries: readonly CandidateDocument[],
): T {
  const rows = takeArray<T>(contentType, entries);
  if (rows.length !== 1) {
    throw new Error(`content type ${contentType} must have exactly one entry`);
  }
  const document = rows[0];
  if (!document) throw new Error(`content type ${contentType} must have exactly one entry`);
  return document;
}
