import type { AreaFarmDocument } from "../../src/modules/content/domain/content-farm.ts";
import {
  isRecord,
  rejectUnknownKeys,
  requireInteger,
  requireNonemptyString,
} from "./json-object-keys.ts";

const ROOT_KEYS = new Set(["_comment", "farm_time_overrides", "stamina_drain_overrides", "areas"]);
const AREA_KEYS = new Set(["tactics", "spots"]);
const SPOT_KEYS = new Set([
  "hunt_spot_id",
  "farm_id",
  "assistant_max",
  "cnt_max",
  "cnt_current",
  "cnt_cooldown",
]);

export type AreaFarmOverrides = Readonly<{
  farmTime: Readonly<Record<string, number>>;
  staminaDrain: Readonly<Record<string, number>>;
}>;

export function areaFarmsFromJson(raw: unknown): {
  spots: AreaFarmDocument[];
  overrides: AreaFarmOverrides;
} {
  if (!isRecord(raw)) throw new Error("area-farms.json root must be an object");
  rejectUnknownKeys(raw, ROOT_KEYS, "area-farms.json");
  requireNonemptyString(raw._comment, "area-farms.json _comment");
  const overrides = {
    farmTime: integerMap(raw.farm_time_overrides, "area-farms.json farm_time_overrides"),
    staminaDrain: integerMap(
      raw.stamina_drain_overrides,
      "area-farms.json stamina_drain_overrides",
    ),
  };
  if (!isRecord(raw.areas)) throw new Error("area-farms.json areas must be an object");
  const spots: AreaFarmDocument[] = [];
  const seen = new Set<string>();
  for (const [areaId, block] of Object.entries(raw.areas)) {
    if (!/^[1-9][0-9]*$/.test(areaId)) throw new Error(`area farm ${areaId} is not a wire area id`);
    if (!isRecord(block)) throw new Error(`area farm ${areaId} must be an object`);
    rejectUnknownKeys(block, AREA_KEYS, `area farm ${areaId}`);
    const tactics = requireInteger(block.tactics, `area farm ${areaId} tactics`);
    if (tactics < 0 || tactics > 2) throw new Error(`area farm ${areaId} tactics is out of range`);
    if (!Array.isArray(block.spots) || block.spots.length < 1) {
      throw new Error(`area farm ${areaId} has no spots`);
    }
    for (const row of block.spots) {
      const spot = spotFromJson(areaId, tactics, row);
      const key = `${spot.areaId}:${spot.huntSpotId}`;
      if (seen.has(key)) throw new Error(`Duplicate area farm ${key}`);
      seen.add(key);
      spots.push(spot);
    }
  }
  if (spots.length < 1) throw new Error("area-farms.json has no spots");
  return {
    spots: spots.sort(
      (left, right) =>
        Number(left.areaId) - Number(right.areaId) || left.huntSpotId - right.huntSpotId,
    ),
    overrides,
  };
}

function spotFromJson(areaId: string, tactics: number, raw: unknown): AreaFarmDocument {
  if (!isRecord(raw)) throw new Error(`area farm ${areaId} spot must be an object`);
  rejectUnknownKeys(raw, SPOT_KEYS, `area farm ${areaId} spot`);
  const huntSpotId = requireInteger(raw.hunt_spot_id, `area farm ${areaId} hunt_spot_id`);
  if (huntSpotId < 1) throw new Error(`area farm ${areaId} hunt_spot_id must be positive`);
  const farmId = requireInteger(raw.farm_id, `area farm ${areaId} farm_id`);
  if (farmId < 1) throw new Error(`area farm ${areaId} farm_id must be positive`);
  const assistantMax = requireInteger(raw.assistant_max, `area farm ${areaId} assistant_max`);
  if (assistantMax < 1) throw new Error(`area farm ${areaId} assistant_max must be positive`);
  const cntMax = requireInteger(raw.cnt_max, `area farm ${areaId} cnt_max`);
  if (cntMax < 1) throw new Error(`area farm ${areaId} cnt_max must be positive`);
  const cntCurrent = requireInteger(raw.cnt_current, `area farm ${areaId} cnt_current`);
  if (cntCurrent < 0) throw new Error(`area farm ${areaId} cnt_current is invalid`);
  const cntCooldown = requireInteger(raw.cnt_cooldown, `area farm ${areaId} cnt_cooldown`);
  if (cntCooldown < 0) throw new Error(`area farm ${areaId} cnt_cooldown is invalid`);
  return {
    areaId,
    huntSpotId,
    farmId,
    tactics,
    assistantMax,
    cntMax,
    cntCurrent,
    cntCooldown,
  };
}

function integerMap(raw: unknown, label: string): Record<string, number> {
  if (!isRecord(raw)) throw new Error(`${label} must be an object`);
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const amount = requireInteger(value, `${label} ${key}`);
    if (amount < 1) throw new Error(`${label} ${key} must be positive`);
    out[key] = amount;
  }
  return out;
}
