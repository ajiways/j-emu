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
  await insertInBatches(
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
    async (batch) => {
      await session.insert(assistantTypes).values(batch);
    },
  );
}

export async function insertFarmResources(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly FarmResourceDocument[],
): Promise<void> {
  if (rows.length === 0) throw new Error("Farm resources are missing");
  await insertInBatches(
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
    async (batch) => {
      await session.insert(farmResources).values(batch);
    },
  );
}

export async function insertAreaFarms(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly AreaFarmDocument[],
): Promise<void> {
  if (rows.length === 0) throw new Error("Area farms are missing");
  await insertInBatches(
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
    async (batch) => {
      await session.insert(areaFarms).values(batch);
    },
  );
}

const INSERT_BATCH = 250;

async function insertInBatches<T>(
  rows: readonly T[],
  write: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += INSERT_BATCH) {
    await write(rows.slice(offset, offset + INSERT_BATCH));
  }
}
