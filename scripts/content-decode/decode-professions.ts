import fs from "node:fs";
import path from "node:path";
import { decodeAmf3 } from "../../src/modules/jugger-wire/amf/amf3.ts";
import type { AreaFarmDocument } from "../../src/modules/content/domain/content-farm.ts";
import type { AssistantTypeDocument } from "../../src/modules/content/domain/content-farm.ts";
import type { FarmResourceDocument } from "../../src/modules/content/domain/content-farm.ts";
import type { CraftRecipeDocument } from "../../src/modules/content/domain/content-craft.ts";
import { areaFarmsFromJson } from "./area-farms-from-json.ts";
import { assistantsFromAmf } from "./assistant-from-amf.ts";
import { farmsFromAmf, farmTypesFromAmf } from "./farm-from-amf.ts";
import { applyFarmTiming } from "./farm-time-policy.ts";
import {
  buildAreaFarmsManifest,
  buildAssistantTypesManifest,
  buildCraftRecipesManifest,
  buildFarmResourcesManifest,
  type ProfessionsManifest,
} from "./professions-manifest.ts";
import { digestOf, fileRecord, type SourceFileRecord } from "./pub1-bots-manifest.ts";
import { recipesFromAmf } from "./recipes-from-amf.ts";

export type DecodeProfessionsResult = Readonly<{
  assistantTypes: readonly AssistantTypeDocument[];
  farmResources: readonly FarmResourceDocument[];
  areaFarms: readonly AreaFarmDocument[];
  craftRecipes: readonly CraftRecipeDocument[];
  assistantTypesManifest: ProfessionsManifest;
  farmResourcesManifest: ProfessionsManifest;
  areaFarmsManifest: ProfessionsManifest;
  craftRecipesManifest: ProfessionsManifest;
}>;

export function decodeProfessions(input: {
  pub1Dir: string;
  areaFarmsFile: string;
}): DecodeProfessionsResult {
  if (!input.pub1Dir) throw new Error("PUB1_DIR is required");
  if (!input.areaFarmsFile) throw new Error("area-farms.json path is required");
  const amfDir = path.join(input.pub1Dir, "images/locale/ru/amf");
  if (!fs.existsSync(amfDir)) throw new Error(`Pub1 AMF directory does not exist: ${amfDir}`);
  const assistantBytes = readAmf(amfDir, "assistant_list.amf");
  const farmTypeBytes = readAmf(amfDir, "farm_types.amf");
  const farmListBytes = readAmf(amfDir, "farm_list.amf");
  const recipeBytes = readAmf(amfDir, "recipes.amf");
  const areaBytes = readBytes(input.areaFarmsFile, "area-farms.json");
  const files: SourceFileRecord[] = [
    fileRecord("images/locale/ru/amf/assistant_list.amf", assistantBytes),
    fileRecord("images/locale/ru/amf/farm_types.amf", farmTypeBytes),
    fileRecord("images/locale/ru/amf/farm_list.amf", farmListBytes),
    fileRecord("images/locale/ru/amf/recipes.amf", recipeBytes),
    fileRecord("area-farms.json", areaBytes),
  ];
  const assistantTypes = assistantsFromAmf(decodeAmf(assistantBytes, "assistant_list.amf"));
  const assistantIds = new Set(assistantTypes.map((row) => row.id));
  for (const row of assistantTypes) {
    if (row.nextArtikulId > 0 && !assistantIds.has(row.nextArtikulId)) {
      throw new Error(`assistant ${row.id} next ${row.nextArtikulId} is missing`);
    }
  }
  const typeIds = farmTypesFromAmf(decodeAmf(farmTypeBytes, "farm_types.amf"));
  const parsedAreas = areaFarmsFromJson(parseJson(areaBytes, input.areaFarmsFile));
  const farmResources = applyFarmTiming(
    farmsFromAmf(decodeAmf(farmListBytes, "farm_list.amf"), typeIds),
    parsedAreas.overrides.farmTime,
    parsedAreas.overrides.staminaDrain,
  );
  const farmIds = new Set(farmResources.map((row) => row.id));
  for (const spot of parsedAreas.spots) {
    if (!farmIds.has(spot.farmId)) {
      throw new Error(`area farm ${spot.areaId}:${spot.huntSpotId} farm ${spot.farmId} is missing`);
    }
  }
  const craftRecipes = recipesFromAmf(decodeAmf(recipeBytes, "recipes.amf"));
  const assistantTypesManifest = buildAssistantTypesManifest({
    files,
    keys: assistantTypes.map((row) => ({ key: String(row.id), digest: digestOf(row) })),
  });
  return {
    assistantTypes,
    farmResources,
    areaFarms: parsedAreas.spots,
    craftRecipes,
    assistantTypesManifest,
    farmResourcesManifest: buildFarmResourcesManifest({
      filesDigest: assistantTypesManifest.filesDigest,
      keys: farmResources.map((row) => ({ key: String(row.id), digest: digestOf(row) })),
    }),
    areaFarmsManifest: buildAreaFarmsManifest({
      filesDigest: assistantTypesManifest.filesDigest,
      keys: parsedAreas.spots.map((row) => ({
        key: `${row.areaId}:${row.huntSpotId}`,
        digest: digestOf(row),
      })),
    }),
    craftRecipesManifest: buildCraftRecipesManifest({
      filesDigest: assistantTypesManifest.filesDigest,
      keys: craftRecipes.map((row) => ({ key: String(row.id), digest: digestOf(row) })),
    }),
  };
}

export function outputDigests(result: DecodeProfessionsResult): {
  assistants: string;
  farms: string;
  areaFarms: string;
  recipes: string;
} {
  return {
    assistants: result.assistantTypesManifest.corpusDigest,
    farms: result.farmResourcesManifest.corpusDigest,
    areaFarms: result.areaFarmsManifest.corpusDigest,
    recipes: result.craftRecipesManifest.corpusDigest,
  };
}

function readAmf(amfDir: string, name: string): Buffer {
  return readBytes(path.join(amfDir, name), name);
}

function decodeAmf(bytes: Buffer, name: string): unknown {
  try {
    return decodeAmf3(bytes);
  } catch (error) {
    throw new Error(`Unreadable AMF record ${name}`, { cause: error });
  }
}

function parseJson(bytes: Buffer, filePath: string): unknown {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`File is not valid JSON: ${filePath}`, { cause: error });
  }
}

function readBytes(filePath: string, label: string): Buffer {
  if (!filePath) throw new Error(`${label} path is required`);
  if (!fs.existsSync(filePath)) throw new Error(`${label} does not exist: ${filePath}`);
  return fs.readFileSync(filePath);
}
