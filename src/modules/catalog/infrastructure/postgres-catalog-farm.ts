import { and, asc, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { AssistantTypeDefinition } from "../domain/assistant-type-definition.ts";
import type { AreaFarmDefinition } from "../domain/area-farm-definition.ts";
import type { FarmResourceDefinition } from "../domain/farm-resource-definition.ts";
import { assistantTypes, areaFarms, farmResources } from "./schema-farms.ts";

export async function loadAssistantType(
  database: PostgresDatabase,
  releaseId: string,
  id: number,
): Promise<AssistantTypeDefinition | null> {
  if (!Number.isInteger(id) || id < 1) throw new Error("Assistant type id is required");
  const rows = await database
    .session()
    .select()
    .from(assistantTypes)
    .where(and(eq(assistantTypes.releaseId, releaseId), eq(assistantTypes.id, id)));
  if (rows.length > 1) throw new Error(`Multiple assistant types found for ${id}`);
  const row = rows[0];
  return row ? toAssistantType(row) : null;
}

export async function loadAssistantTypes(
  database: PostgresDatabase,
  releaseId: string,
): Promise<readonly AssistantTypeDefinition[]> {
  const rows = await database
    .session()
    .select()
    .from(assistantTypes)
    .where(eq(assistantTypes.releaseId, releaseId))
    .orderBy(asc(assistantTypes.id));
  return rows.map(toAssistantType);
}

export async function loadFarmResource(
  database: PostgresDatabase,
  releaseId: string,
  id: number,
): Promise<FarmResourceDefinition | null> {
  if (!Number.isInteger(id) || id < 1) throw new Error("Farm resource id is required");
  const rows = await database
    .session()
    .select()
    .from(farmResources)
    .where(and(eq(farmResources.releaseId, releaseId), eq(farmResources.id, id)));
  if (rows.length > 1) throw new Error(`Multiple farm resources found for ${id}`);
  const row = rows[0];
  return row ? toFarmResource(row) : null;
}

export async function loadAreaFarms(
  database: PostgresDatabase,
  releaseId: string,
  areaId: string,
): Promise<readonly AreaFarmDefinition[]> {
  if (!areaId) throw new Error("Area id is required");
  const rows = await database
    .session()
    .select()
    .from(areaFarms)
    .where(and(eq(areaFarms.releaseId, releaseId), eq(areaFarms.areaId, areaId)))
    .orderBy(asc(areaFarms.huntSpotId));
  return rows.map((row) => ({
    areaId: row.areaId,
    huntSpotId: row.huntSpotId,
    farmId: row.farmId,
    tactics: row.tactics,
    assistantMax: row.assistantMax,
    cntMax: row.cntMax,
    cntCooldown: row.cntCooldown,
  }));
}

function toAssistantType(row: {
  id: number;
  title: string;
  description: string;
  profession: number;
  level: number;
  quality: number;
  nextArtikulId: number;
  skillSum: number;
  price: number;
  priceType: number;
  picture: string;
  restrictionsXml: string;
  voodooEnergy: number;
}): AssistantTypeDefinition {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    profession: row.profession,
    level: row.level,
    quality: row.quality,
    nextArtikulId: row.nextArtikulId,
    skillSum: row.skillSum,
    price: row.price,
    priceType: row.priceType,
    picture: row.picture,
    restrictionsXml: row.restrictionsXml,
    voodooEnergy: row.voodooEnergy,
  };
}

function toFarmResource(row: {
  id: number;
  title: string;
  typeId: number;
  picture: string;
  swf: string;
  quality: number;
  profession: number;
  artifactArtikulId: number;
  masteryValue: number;
  masteryMax: number;
  farmTime: number;
  staminaDrain: number;
}): FarmResourceDefinition {
  return {
    id: row.id,
    title: row.title,
    typeId: row.typeId,
    picture: row.picture,
    swf: row.swf,
    quality: row.quality,
    profession: row.profession,
    artifactArtikulId: row.artifactArtikulId,
    masteryValue: row.masteryValue,
    masteryMax: row.masteryMax,
    farmTime: row.farmTime,
    staminaDrain: row.staminaDrain,
  };
}
