import { PROFESSION_ID_MAX } from "../../src/modules/catalog/domain/profession-ids.ts";
import type { FarmResourceDocument } from "../../src/modules/content/domain/content-farm.ts";
import { amfInteger, amfString, isRecord } from "./amf-fields.ts";
import { amfRecordList } from "./amf-record-list.ts";
import { DUMP_FARM_TIME_SEC, DUMP_STAMINA_DRAIN } from "./farm-time-policy.ts";
import { rejectUnknownKeys } from "./json-object-keys.ts";

const FARM_TYPE_KEYS = new Set(["id", "title"]);
const FARM_KEYS = new Set([
  "id",
  "title",
  "type_id",
  "picture",
  "swf",
  "quality",
  "profession",
  "artifact_artikul_id",
  "mastery_value",
  "mastery_max",
]);

export function farmTypesFromAmf(raw: unknown): ReadonlySet<number> {
  const rows = amfRecordList(raw, "farm_types.amf");
  const ids = new Set<number>();
  for (const row of rows) {
    if (!isRecord(row)) throw new Error("farm_types.amf row must be an object");
    rejectUnknownKeys(row, FARM_TYPE_KEYS, "farm_types.amf row");
    const id = amfInteger(row.id, "farm_types.amf id");
    if (id < 1) throw new Error(`farm type ${id} id must be positive`);
    if (ids.has(id)) throw new Error(`Duplicate farm type ${id}`);
    const title = amfString(row.title, `farm type ${id} title`);
    if (!title) throw new Error(`farm type ${id} title is required`);
    ids.add(id);
  }
  if (ids.size < 1) throw new Error("farm_types.amf has no types");
  return ids;
}

export function farmsFromAmf(raw: unknown, typeIds: ReadonlySet<number>): FarmResourceDocument[] {
  const rows = amfRecordList(raw, "farm_list.amf");
  const farms: FarmResourceDocument[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    const farm = farmFromAmf(row, typeIds);
    if (seen.has(farm.id)) throw new Error(`Duplicate farm resource ${farm.id}`);
    seen.add(farm.id);
    farms.push(farm);
  }
  if (farms.length < 1) throw new Error("farm_list.amf has no farms");
  return farms.sort((left, right) => left.id - right.id);
}

function farmFromAmf(
  raw: Record<string, unknown>,
  typeIds: ReadonlySet<number>,
): FarmResourceDocument {
  if (!isRecord(raw)) throw new Error("farm_list.amf row must be an object");
  rejectUnknownKeys(raw, FARM_KEYS, "farm_list.amf row");
  const id = amfInteger(raw.id, "farm_list.amf id");
  if (id < 1) throw new Error(`farm ${id} id must be positive`);
  const typeId = amfInteger(raw.type_id, `farm ${id} type_id`);
  if (!typeIds.has(typeId))
    throw new Error(`farm ${id} type ${typeId} is missing from farm_types.amf`);
  const profession = amfInteger(raw.profession, `farm ${id} profession`);
  if (profession < 0 || profession > PROFESSION_ID_MAX) {
    throw new Error(`farm ${id} profession ${profession} is out of range`);
  }
  const quality = amfInteger(raw.quality, `farm ${id} quality`);
  if (quality < 0) throw new Error(`farm ${id} quality is invalid`);
  const artifactArtikulId = amfInteger(raw.artifact_artikul_id, `farm ${id} artifact_artikul_id`);
  if (artifactArtikulId < 1) throw new Error(`farm ${id} artifact_artikul_id must be positive`);
  const masteryValue = amfInteger(raw.mastery_value, `farm ${id} mastery_value`);
  if (masteryValue < 0) throw new Error(`farm ${id} mastery_value is invalid`);
  const masteryMax = amfInteger(raw.mastery_max, `farm ${id} mastery_max`);
  if (masteryMax < 1) throw new Error(`farm ${id} mastery_max must be positive`);
  const title = amfString(raw.title, `farm ${id} title`);
  if (!title) throw new Error(`farm ${id} title is required`);
  const picture = amfString(raw.picture, `farm ${id} picture`);
  if (!picture) throw new Error(`farm ${id} picture is required`);
  return {
    id,
    title,
    typeId,
    picture,
    swf: amfString(raw.swf, `farm ${id} swf`),
    quality,
    profession,
    artifactArtikulId,
    masteryValue,
    masteryMax,
    farmTime: DUMP_FARM_TIME_SEC,
    staminaDrain: DUMP_STAMINA_DRAIN,
  };
}
