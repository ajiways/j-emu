import type { ContentEntry } from "./content-document.ts";
import { areaDocumentSchema, areaLinkDocumentSchema } from "./parse-area-content.ts";
import { artifactDocumentSchema } from "./parse-artifact-content.ts";
import {
  appearanceDocumentSchema,
  bootstrapChromeDocumentSchema,
  commonConfDocumentSchema,
  hudDefaultsDocumentSchema,
  levelBoundaryDocumentSchema,
  skillDocumentSchema,
  welcomeMessageDocumentSchema,
} from "./parse-bootstrap-content.ts";
import { botDocumentSchema } from "./parse-bot-content.ts";
import { battlegroundDocumentSchema } from "./parse-battleground-content.ts";
import { craftRecipeDocumentSchema } from "./parse-craft-content.ts";
import { dungeonDocumentSchema } from "./parse-dungeon-content.ts";
import {
  areaFarmDocumentSchema,
  assistantTypeDocumentSchema,
  farmResourceDocumentSchema,
} from "./parse-farm-content.ts";
import { huntSpawnDocumentSchema } from "./parse-hunt-content.ts";
import { professionDocumentSchema } from "./parse-profession-content.ts";
import {
  npcDocumentSchema,
  questDocumentSchema,
  worldFactDocumentSchema,
} from "./parse-quest-content.ts";
import { reputationTrackDocumentSchema } from "./parse-reputation-content.ts";
import { storeLotDocumentSchema, storeTypeDocumentSchema } from "./parse-store-content.ts";
import { bonusDocumentSchema, useScriptDocumentSchema } from "./parse-use-content.ts";

export const CONTENT_TYPES = [
  "artifact",
  "bot",
  "area",
  "area_link",
  "hunt_spawn",
  "dungeon",
  "battleground",
  "store_type",
  "store_lot",
  "reputation_track",
  "profession",
  "assistant_type",
  "farm_resource",
  "area_farm",
  "craft_recipe",
  "npc",
  "quest",
  "world_fact",
  "bonus",
  "use_script",
  "skill",
  "level",
  "appearance",
  "hud_defaults",
  "chrome",
  "common_conf",
  "welcome_message",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export function isContentType(value: string): value is ContentType {
  return (CONTENT_TYPES as readonly string[]).includes(value);
}

export function parseDraftDocument(
  contentType: ContentType,
  document: unknown,
): ContentEntry["document"] {
  switch (contentType) {
    case "artifact":
      return artifactDocumentSchema.parse(document) as ContentEntry["document"];
    case "bot":
      return botDocumentSchema.parse(document) as ContentEntry["document"];
    case "area":
      return areaDocumentSchema.parse(document) as ContentEntry["document"];
    case "area_link":
      return areaLinkDocumentSchema.parse(document) as ContentEntry["document"];
    case "hunt_spawn":
      return huntSpawnDocumentSchema.parse(document) as ContentEntry["document"];
    case "dungeon":
      return dungeonDocumentSchema.parse(document) as ContentEntry["document"];
    case "battleground":
      return battlegroundDocumentSchema.parse(document) as ContentEntry["document"];
    case "store_type":
      return storeTypeDocumentSchema.parse(document) as ContentEntry["document"];
    case "store_lot":
      return storeLotDocumentSchema.parse(document) as ContentEntry["document"];
    case "reputation_track":
      return reputationTrackDocumentSchema.parse(document) as ContentEntry["document"];
    case "profession":
      return professionDocumentSchema.parse(document) as ContentEntry["document"];
    case "assistant_type":
      return assistantTypeDocumentSchema.parse(document) as ContentEntry["document"];
    case "farm_resource":
      return farmResourceDocumentSchema.parse(document) as ContentEntry["document"];
    case "area_farm":
      return areaFarmDocumentSchema.parse(document) as ContentEntry["document"];
    case "craft_recipe":
      return craftRecipeDocumentSchema.parse(document) as ContentEntry["document"];
    case "npc":
      return npcDocumentSchema.parse(document) as ContentEntry["document"];
    case "quest":
      return questDocumentSchema.parse(document) as ContentEntry["document"];
    case "world_fact":
      return worldFactDocumentSchema.parse(document) as ContentEntry["document"];
    case "bonus":
      return bonusDocumentSchema.parse(document) as ContentEntry["document"];
    case "use_script":
      return useScriptDocumentSchema.parse(document) as ContentEntry["document"];
    case "skill":
      return skillDocumentSchema.parse(document) as ContentEntry["document"];
    case "level":
      return levelBoundaryDocumentSchema.parse(document) as ContentEntry["document"];
    case "appearance":
      return appearanceDocumentSchema.parse(document) as ContentEntry["document"];
    case "hud_defaults":
      return hudDefaultsDocumentSchema.parse(document) as ContentEntry["document"];
    case "chrome":
      return bootstrapChromeDocumentSchema.parse(document) as ContentEntry["document"];
    case "common_conf":
      return commonConfDocumentSchema.parse(document) as ContentEntry["document"];
    case "welcome_message":
      return welcomeMessageDocumentSchema.parse(document) as ContentEntry["document"];
  }
}
