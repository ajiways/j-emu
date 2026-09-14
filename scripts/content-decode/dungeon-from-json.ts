import type { DungeonDocument } from "../../src/modules/content/domain/content-dungeon.ts";
import { spawnsFromJson } from "./dungeon-spawn-from-json.ts";
import {
  isRecord,
  rejectUnknownKeys,
  requireInteger,
  requireNonemptyString,
  requireString,
} from "./json-object-keys.ts";

const ROOT_KEYS = new Set([
  "artikul_id",
  "title",
  "start_area_id",
  "parent_area_id",
  "level_min",
  "duration_sec",
  "img_url",
  "has_clear",
  "progress_finish_value",
  "clear",
  "loot",
  "areas",
  "mob_loot",
]);
const AREA_KEYS = new Set(["area_id", "spawns"]);
const CLEAR_KEYS = new Set(["coin_artikul_id", "coin_min", "coin_max"]);
const LOOT_KEYS = new Set(["boss_bot_id", "personal_guaranteed", "bands", "chance"]);

export function dungeonFromJson(raw: unknown, fileName: string): DungeonDocument {
  if (!isRecord(raw)) throw new Error(`${fileName} root must be an object`);
  rejectUnknownKeys(raw, ROOT_KEYS, fileName);
  const artikulId = requirePositive(raw.artikul_id, `${fileName} artikul_id`);
  const label = `dungeon ${artikulId}`;
  const hasClear = requireBoolean(raw.has_clear, `${label} has_clear`);
  return {
    artikulId,
    title: requireNonemptyString(raw.title, `${label} title`),
    startAreaId: areaId(raw.start_area_id, `${label} start_area_id`),
    parentAreaId: areaId(raw.parent_area_id, `${label} parent_area_id`),
    levelMin: requirePositive(raw.level_min, `${label} level_min`),
    durationSec: requirePositive(raw.duration_sec, `${label} duration_sec`),
    imgUrl: requireNonemptyString(raw.img_url, `${label} img_url`),
    hasClear,
    areas: areasFromJson(raw.areas, label),
    ...finishFields(raw, hasClear, label),
    ...lootFields(raw.loot, label),
  };
}

function finishFields(
  raw: Record<string, unknown>,
  hasClear: boolean,
  label: string,
): Pick<DungeonDocument, "progressFinishValue" | "clear"> {
  if (!hasClear) {
    if (raw.progress_finish_value !== undefined) {
      throw new Error(`${label} has_clear is false but progress_finish_value is authored`);
    }
    if (raw.clear !== undefined) {
      throw new Error(`${label} has_clear is false but clear coins are authored`);
    }
    return {};
  }
  const progressFinishValue = requirePositive(
    raw.progress_finish_value,
    `${label} progress_finish_value`,
  );
  if (raw.clear === undefined) return { progressFinishValue };
  if (!isRecord(raw.clear)) throw new Error(`${label} clear must be an object`);
  rejectUnknownKeys(raw.clear, CLEAR_KEYS, `${label} clear`);
  const coinMin = requirePositive(raw.clear.coin_min, `${label} clear.coin_min`);
  const coinMax = requirePositive(raw.clear.coin_max, `${label} clear.coin_max`);
  if (coinMax < coinMin) throw new Error(`${label} clear.coin_max is below coin_min`);
  return {
    progressFinishValue,
    clear: {
      coinArtikulId: requirePositive(raw.clear.coin_artikul_id, `${label} clear.coin_artikul_id`),
      coinMin,
      coinMax,
    },
  };
}

function lootFields(raw: unknown, label: string): Pick<DungeonDocument, "loot"> {
  if (raw === undefined) return {};
  if (!isRecord(raw)) throw new Error(`${label} loot must be an object`);
  rejectUnknownKeys(raw, LOOT_KEYS, `${label} loot`);
  return {
    loot: {
      personalGuaranteed: personalIds(raw.personal_guaranteed, label),
      ...bossBot(raw.boss_bot_id, label),
    },
  };
}

function bossBot(raw: unknown, label: string): { bossBotId: number } | Record<string, never> {
  if (raw === undefined) return {};
  const bossBotId = requireInteger(raw, `${label} loot.boss_bot_id`);
  if (bossBotId < 0) throw new Error(`${label} loot.boss_bot_id is invalid`);
  if (bossBotId === 0) return {};
  return { bossBotId };
}

function personalIds(raw: unknown, label: string): number[] {
  if (!Array.isArray(raw)) throw new Error(`${label} loot.personal_guaranteed must be an array`);
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const [index, value] of raw.entries()) {
    const id = requirePositive(value, `${label} loot.personal_guaranteed[${index}]`);
    if (seen.has(id)) throw new Error(`${label} loot.personal_guaranteed has duplicate ${id}`);
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function areasFromJson(raw: unknown, label: string): DungeonDocument["areas"] {
  if (!Array.isArray(raw) || raw.length < 1) throw new Error(`${label} has no areas`);
  const areas: DungeonDocument["areas"][number][] = [];
  const seen = new Set<string>();
  for (const [index, value] of raw.entries()) {
    if (!isRecord(value)) throw new Error(`${label} areas[${index}] must be an object`);
    rejectUnknownKeys(value, AREA_KEYS, `${label} areas[${index}]`);
    const areaIdValue = areaId(value.area_id, `${label} areas[${index}] area_id`);
    if (seen.has(areaIdValue)) throw new Error(`${label} has duplicate area ${areaIdValue}`);
    seen.add(areaIdValue);
    areas.push({
      areaId: areaIdValue,
      spawns: spawnsFromJson(value.spawns, `${label} area ${areaIdValue}`),
    });
  }
  return areas;
}

function requireBoolean(raw: unknown, label: string): boolean {
  if (typeof raw !== "boolean") throw new Error(`${label} must be a boolean`);
  return raw;
}

function requirePositive(raw: unknown, label: string): number {
  const value = requireInteger(raw, label);
  if (value < 1) throw new Error(`${label} must be positive`);
  return value;
}

function areaId(raw: unknown, label: string): string {
  const id = requireString(raw, label);
  if (!/^[1-9][0-9]*$/.test(id)) throw new Error(`${label} is not a wire area id`);
  return id;
}
