import { z } from "zod";
import { PLAYABLE_SLICE_SCHEMA_VERSION, type ContentBundle } from "./content-document.ts";
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
import { storeLotsSchema, storeTypesSchema } from "./parse-store-content.ts";
import { reputationTracksSchema } from "./parse-reputation-content.ts";
import { professionsSchema } from "./parse-profession-content.ts";
import {
  areaFarmsSchema,
  assistantTypesSchema,
  farmResourcesSchema,
} from "./parse-farm-content.ts";
import { craftRecipesSchema } from "./parse-craft-content.ts";
import { dungeonsSchema } from "./parse-dungeon-content.ts";
import { battlegroundsSchema } from "./parse-battleground-content.ts";
import { bonusDocumentSchema, useScriptDocumentSchema } from "./parse-use-content.ts";
import { huntSpawnsSchema } from "./parse-hunt-content.ts";
import { npcsSchema, questsSchema, worldFactsSchema } from "./parse-quest-content.ts";

const bundleSchema = z
  .object({
    schemaVersion: z.literal(PLAYABLE_SLICE_SCHEMA_VERSION),
    artifacts: z.array(artifactDocumentSchema),
    bots: z.array(botDocumentSchema),
    areas: z.array(areaDocumentSchema),
    areaLinks: z.array(areaLinkDocumentSchema),
    huntSpawns: huntSpawnsSchema,
    dungeons: dungeonsSchema,
    battlegrounds: battlegroundsSchema,
    storeTypes: storeTypesSchema,
    storeLots: storeLotsSchema,
    reputationTracks: reputationTracksSchema,
    professions: professionsSchema,
    assistantTypes: assistantTypesSchema,
    farmResources: farmResourcesSchema,
    areaFarms: areaFarmsSchema,
    craftRecipes: craftRecipesSchema,
    npcs: npcsSchema,
    quests: questsSchema,
    worldFacts: worldFactsSchema,
    bonuses: z.array(bonusDocumentSchema),
    useScripts: z.array(useScriptDocumentSchema),
    skills: z.array(skillDocumentSchema).min(1),
    levels: z.array(levelBoundaryDocumentSchema).min(1),
    appearances: z.array(appearanceDocumentSchema).min(1),
    hudDefaults: hudDefaultsDocumentSchema,
    chrome: bootstrapChromeDocumentSchema,
    commonConf: commonConfDocumentSchema,
    welcomeMessage: welcomeMessageDocumentSchema,
  })
  .strict();

export function parseContentBundle(value: unknown): ContentBundle {
  return bundleSchema.parse(value) as ContentBundle;
}
