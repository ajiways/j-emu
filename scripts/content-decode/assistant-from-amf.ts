import { PROFESSION_ID_MAX } from "../../src/modules/catalog/domain/profession-ids.ts";
import type { AssistantTypeDocument } from "../../src/modules/content/domain/content-farm.ts";
import { amfInteger, amfString, isRecord } from "./amf-fields.ts";
import { amfRecordList } from "./amf-record-list.ts";
import { rejectUnknownKeys } from "./json-object-keys.ts";

const ASSISTANT_KEYS = new Set([
  "id",
  "title",
  "description",
  "profession",
  "level",
  "quality",
  "next_artikul_id",
  "skill_sum",
  "price",
  "price_type",
  "picture",
  "restrictions",
  "voodoo_energy",
]);

export function assistantsFromAmf(raw: unknown): AssistantTypeDocument[] {
  const rows = amfRecordList(raw, "assistant_list.amf");
  const assistants: AssistantTypeDocument[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    const assistant = assistantFromAmf(row);
    if (!assistant) continue;
    if (seen.has(assistant.id)) throw new Error(`Duplicate assistant type ${assistant.id}`);
    seen.add(assistant.id);
    assistants.push(assistant);
  }
  if (assistants.length < 1) throw new Error("assistant_list.amf has no assistants");
  return assistants.sort((left, right) => left.id - right.id);
}

function assistantFromAmf(raw: Record<string, unknown>): AssistantTypeDocument | null {
  if (!isRecord(raw)) throw new Error("assistant_list.amf row must be an object");
  rejectUnknownKeys(raw, ASSISTANT_KEYS, "assistant_list.amf row");
  const id = amfInteger(raw.id, "assistant_list.amf id");
  if (id < 1) throw new Error(`assistant ${id} id must be positive`);
  const profession = amfInteger(raw.profession, `assistant ${id} profession`);
  if (profession === 0) return null;
  if (profession < 1 || profession > PROFESSION_ID_MAX) {
    throw new Error(`assistant ${id} profession ${profession} is out of range`);
  }
  const level = amfInteger(raw.level, `assistant ${id} level`);
  if (level < 1) throw new Error(`assistant ${id} level must be positive`);
  const quality = amfInteger(raw.quality, `assistant ${id} quality`);
  if (quality < 0) throw new Error(`assistant ${id} quality is invalid`);
  const nextArtikulId = amfInteger(raw.next_artikul_id, `assistant ${id} next_artikul_id`);
  if (nextArtikulId < 0) throw new Error(`assistant ${id} next_artikul_id is invalid`);
  const skillSum = amfInteger(raw.skill_sum, `assistant ${id} skill_sum`);
  if (skillSum < 1) throw new Error(`assistant ${id} skill_sum must be positive`);
  const price = amfInteger(raw.price, `assistant ${id} price`);
  if (price < 0) throw new Error(`assistant ${id} price is invalid`);
  const priceType = amfInteger(raw.price_type, `assistant ${id} price_type`);
  if (priceType < 1) throw new Error(`assistant ${id} price_type must be positive`);
  const voodooEnergy = amfInteger(raw.voodoo_energy, `assistant ${id} voodoo_energy`);
  if (voodooEnergy < 0) throw new Error(`assistant ${id} voodoo_energy is invalid`);
  return {
    id,
    title: requirePicture(amfString(raw.title, `assistant ${id} title`), `assistant ${id} title`),
    description: amfString(raw.description, `assistant ${id} description`),
    profession,
    level,
    quality,
    nextArtikulId,
    skillSum,
    price,
    priceType,
    picture: requirePicture(
      amfString(raw.picture, `assistant ${id} picture`),
      `assistant ${id} picture`,
    ),
    restrictionsXml: amfString(raw.restrictions, `assistant ${id} restrictions`),
    voodooEnergy,
  };
}

function requirePicture(value: string, label: string): string {
  if (!value) throw new Error(`${label} is required`);
  return value;
}
