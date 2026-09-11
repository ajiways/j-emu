import type { AssistantTypeDocument } from "../../content/domain/content-farm.ts";
import type { AreaFarmDocument } from "../../content/domain/content-farm.ts";
import type { FarmResourceDocument } from "../../content/domain/content-farm.ts";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { assistantTypes, areaFarms, farmResources } from "./schema-farms.ts";

export async function insertAssistantTypes(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly AssistantTypeDocument[],
): Promise<void> {
  if (rows.length === 0) throw new Error("Assistant types are missing");
  await session.insert(assistantTypes).values(
    rows.map((row) => ({
      releaseId,
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
    })),
  );
}

export async function insertFarmResources(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly FarmResourceDocument[],
): Promise<void> {
  if (rows.length === 0) throw new Error("Farm resources are missing");
  await session.insert(farmResources).values(
    rows.map((row) => ({
      releaseId,
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
    })),
  );
}

export async function insertAreaFarms(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly AreaFarmDocument[],
): Promise<void> {
  if (rows.length === 0) throw new Error("Area farms are missing");
  await session.insert(areaFarms).values(
    rows.map((row) => ({
      releaseId,
      areaId: row.areaId,
      huntSpotId: row.huntSpotId,
      farmId: row.farmId,
      tactics: row.tactics,
      assistantMax: row.assistantMax,
      cntMax: row.cntMax,
      cntCooldown: row.cntCooldown,
    })),
  );
}
