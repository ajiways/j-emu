import type { AreaDocument } from "../../src/modules/content/domain/content-playable-entities.ts";
import {
  isRecord,
  optionalInteger,
  rejectUnknownKeys,
  requireFlag,
  requireNonemptyString,
  requireString,
} from "./json-object-keys.ts";

const AREA_KEYS = new Set([
  "id",
  "title",
  "parent_id",
  "region_map",
  "swf",
  "settlement",
  "fight_bg",
  "code",
  "ftime_max",
  "items",
  "extra_json",
  "inst_artikul_id",
  "context",
  "sound_intro",
  "sound_bg",
  "hunt_bots",
  "hunt_farm",
  "client_data",
]);

const EXTRA_KEYS = new Set(["bg_id", "pin_overrides", "swf_flip_x"]);

export type FixtureAreaRow = Readonly<{
  area: AreaDocument;
  items: readonly unknown[];
}>;

export function areaFromFixture(mapKey: string, raw: unknown): FixtureAreaRow {
  if (!isRecord(raw)) throw new Error(`area ${mapKey} must be an object`);
  rejectUnknownKeys(raw, AREA_KEYS, `area ${mapKey}`);
  const id = requireNonemptyString(raw.id ?? mapKey, `area ${mapKey} id`);
  if (id !== mapKey) throw new Error(`area ${mapKey} id ${id} does not match map key`);
  if (!/^[1-9][0-9]*$/.test(id)) throw new Error(`area ${mapKey} id is not a wire area id`);
  const extra = extraJson(raw.extra_json, id);
  const items = raw.items === undefined ? [] : raw.items;
  if (!Array.isArray(items)) throw new Error(`area ${id} items must be an array`);
  if (raw.settlement !== undefined && typeof raw.settlement !== "boolean") {
    throw new Error(`area ${id} settlement must be a boolean`);
  }
  return {
    area: {
      id,
      title: requireNonemptyString(raw.title, `area ${id} title`),
      parentId: parentId(raw.parent_id, id),
      map: requireNonemptyString(raw.swf, `area ${id} swf`),
      fightBackground: requireString(raw.fight_bg ?? "", `area ${id} fight_bg`),
      regionMap: requireString(raw.region_map ?? "", `area ${id} region_map`),
      ftimeMax: optionalInteger(raw.ftime_max, `area ${id} ftime_max`, 0),
      code: requireString(raw.code ?? "", `area ${id} code`),
      context: requireString(raw.context ?? "", `area ${id} context`),
      soundIntro: requireString(raw.sound_intro ?? "", `area ${id} sound_intro`),
      soundBg: requireString(raw.sound_bg ?? "", `area ${id} sound_bg`),
      instArtikulId: optionalInteger(raw.inst_artikul_id, `area ${id} inst_artikul_id`, 0),
      haveTradeChannel: 0,
      haveKindChannel: 0,
      hideFinishedFights: 0,
      hideRunningFights: 0,
      noClanChat: 0,
      bgId: extra.bgId,
    },
    items,
  };
}

function parentId(value: unknown, areaId: string): string {
  if (value === undefined || value === null || value === "") return "";
  const parent =
    typeof value === "number" ? String(value) : requireString(value, `area ${areaId} parent_id`);
  if (!/^[1-9][0-9]*$/.test(parent))
    throw new Error(`area ${areaId} parent_id is not a wire area id`);
  return parent;
}

function extraJson(value: unknown, areaId: string): { bgId: string } {
  if (value === undefined) return { bgId: "" };
  if (!isRecord(value)) throw new Error(`area ${areaId} extra_json must be an object`);
  rejectUnknownKeys(value, EXTRA_KEYS, `area ${areaId} extra_json`);
  if (value.bg_id === undefined) return { bgId: "" };
  return { bgId: requireString(value.bg_id, `area ${areaId} extra_json.bg_id`) };
}

export function requireAreaPresentation(area: AreaDocument): AreaDocument {
  if (!area.map) throw new Error(`area ${area.id} is missing map SWF`);
  if (!area.fightBackground) throw new Error(`area ${area.id} is missing fight background`);
  if (!area.regionMap) throw new Error(`area ${area.id} is missing region_map`);
  requireFlag(area.haveTradeChannel, `area ${area.id} haveTradeChannel`);
  requireFlag(area.haveKindChannel, `area ${area.id} haveKindChannel`);
  requireFlag(area.hideFinishedFights, `area ${area.id} hideFinishedFights`);
  requireFlag(area.hideRunningFights, `area ${area.id} hideRunningFights`);
  requireFlag(area.noClanChat, `area ${area.id} noClanChat`);
  if (area.ftimeMax < 0) throw new Error(`area ${area.id} ftimeMax is invalid`);
  if (area.instArtikulId < 0) throw new Error(`area ${area.id} instArtikulId is invalid`);
  return area;
}
