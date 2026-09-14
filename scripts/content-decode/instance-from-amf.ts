import { amfInteger, amfString, isRecord } from "./amf-fields.ts";
import { rejectUnknownKeys } from "./json-object-keys.ts";

const ROOT_KEYS = new Set(["instance", "macroses"]);
const INSTANCE_KEYS = new Set([
  "id",
  "title",
  "level_min",
  "level_max",
  "flags",
  "progress_desc",
  "area_info",
  "img_url",
  "description_full",
  "show_in_book",
]);

export type InstanceAmfRow = Readonly<{
  id: number;
  title: string;
  levelMin: number;
}>;

export function instancesFromAmf(raw: unknown): ReadonlyMap<number, InstanceAmfRow> {
  if (!isRecord(raw)) throw new Error("instance.amf root must be an object");
  rejectUnknownKeys(raw, ROOT_KEYS, "instance.amf");
  if (!isRecord(raw.macroses)) throw new Error("instance.amf macroses must be an object");
  if (!Array.isArray(raw.instance)) throw new Error("instance.amf instance must be an array");
  const rows = new Map<number, InstanceAmfRow>();
  for (const [index, value] of raw.instance.entries()) {
    if (!isRecord(value)) throw new Error(`instance.amf instance[${index}] must be an object`);
    rejectUnknownKeys(value, INSTANCE_KEYS, `instance.amf instance[${index}]`);
    const id = amfInteger(value.id, `instance.amf instance[${index}] id`);
    if (id < 1) throw new Error(`instance.amf id ${id} must be positive`);
    if (rows.has(id)) throw new Error(`Duplicate instance.amf id ${id}`);
    const title = amfString(value.title, `instance.amf ${id} title`);
    if (!title) throw new Error(`instance.amf ${id} title is required`);
    const levelMin = amfInteger(value.level_min, `instance.amf ${id} level_min`);
    if (levelMin < 0) throw new Error(`instance.amf ${id} level_min is invalid`);
    rows.set(id, { id, title, levelMin });
  }
  if (rows.size < 1) throw new Error("instance.amf has no instances");
  return rows;
}
