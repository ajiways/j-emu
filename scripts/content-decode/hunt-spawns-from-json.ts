import type { HuntSpawnDocument } from "../../src/modules/content/domain/content-playable-entities.ts";
import { huntSpawnDocumentSchema } from "../../src/modules/content/domain/parse-hunt-content.ts";
import {
  isRecord,
  optionalInteger,
  rejectUnknownKeys,
  requireInteger,
  requireNonemptyString,
} from "./json-object-keys.ts";

const ROOT_KEYS = new Set(["note", "areas"]);
const SPAWN_KEYS = new Set([
  "id",
  "artikul_id",
  "hunt_mask",
  "position_x",
  "position_y",
  "zone",
  "route",
  "wait_min",
  "wait_max",
  "respawn_time_min",
  "respawn_time_max",
]);
const POINT_KEYS = new Set(["x", "y"]);
const STOP_KEYS = new Set(["x", "y", "wait_min", "wait_max"]);

export function huntSpawnsFromJson(
  raw: unknown,
  areaIds: ReadonlySet<string>,
  eventBotIds: ReadonlySet<number>,
): HuntSpawnDocument[] {
  if (!isRecord(raw)) throw new Error("hunt_spawns root must be an object");
  rejectUnknownKeys(raw, ROOT_KEYS, "hunt_spawns");
  if (!isRecord(raw.areas)) throw new Error("hunt_spawns.areas must be an object");
  const spawns: HuntSpawnDocument[] = [];
  const seen = new Set<number>();
  for (const [areaId, rows] of Object.entries(raw.areas)) {
    if (!areaIds.has(areaId)) throw new Error(`hunt_spawns area ${areaId} is not in the atlas`);
    if (!Array.isArray(rows)) throw new Error(`hunt_spawns area ${areaId} must be an array`);
    for (const [index, row] of rows.entries()) {
      const spawn = spawnFromRow(areaId, row, index);
      if (eventBotIds.has(spawn.botId)) {
        throw new Error(`hunt_spawn ${spawn.id} bot ${spawn.botId} is an event artikul`);
      }
      if (seen.has(spawn.id)) throw new Error(`Duplicate hunt_spawn ${spawn.id}`);
      seen.add(spawn.id);
      spawns.push(huntSpawnDocumentSchema.parse(spawn));
    }
  }
  return spawns.sort((left, right) => left.id - right.id);
}

function spawnFromRow(areaId: string, raw: unknown, index: number): HuntSpawnDocument {
  const label = `hunt_spawns ${areaId}[${index}]`;
  if (!isRecord(raw)) throw new Error(`${label} must be an object`);
  rejectUnknownKeys(raw, SPAWN_KEYS, label);
  const id = requireInteger(raw.id, `${label} id`);
  const expectedArea = String(Math.floor(id / 100));
  if (expectedArea !== areaId) throw new Error(`${label} id ${id} is outside area ${areaId}`);
  return {
    id,
    areaId,
    botId: requireInteger(raw.artikul_id, `${label} artikul_id`),
    x: requireNumber(raw.position_x, `${label} position_x`),
    y: requireNumber(raw.position_y, `${label} position_y`),
    huntMask: requireNonemptyString(raw.hunt_mask, `${label} hunt_mask`),
    waitMin: omittedWait(raw.wait_min, `${label} wait_min`),
    waitMax: omittedWait(raw.wait_max, `${label} wait_max`),
    respawnTimeMin: omittedWait(raw.respawn_time_min, `${label} respawn_time_min`),
    respawnTimeMax: omittedWait(raw.respawn_time_max, `${label} respawn_time_max`),
    zone: points(raw.zone, `${label} zone`),
    route: stops(raw.route, `${label} route`),
  };
}

function points(raw: unknown, label: string): { x: number; y: number }[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error(`${label} must be an array`);
  return raw.map((row, index) => {
    if (!isRecord(row)) throw new Error(`${label}[${index}] must be an object`);
    rejectUnknownKeys(row, POINT_KEYS, `${label}[${index}]`);
    return {
      x: requireNumber(row.x, `${label}[${index}] x`),
      y: requireNumber(row.y, `${label}[${index}] y`),
    };
  });
}

function stops(
  raw: unknown,
  label: string,
): { x: number; y: number; waitMin: number; waitMax: number }[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error(`${label} must be an array`);
  return raw.map((row, index) => {
    if (!isRecord(row)) throw new Error(`${label}[${index}] must be an object`);
    rejectUnknownKeys(row, STOP_KEYS, `${label}[${index}]`);
    return {
      x: requireNumber(row.x, `${label}[${index}] x`),
      y: requireNumber(row.y, `${label}[${index}] y`),
      waitMin: requireInteger(row.wait_min, `${label}[${index}] wait_min`),
      waitMax: requireInteger(row.wait_max, `${label}[${index}] wait_max`),
    };
  });
}

/** Authored hunt JSON omits wait/respawn when the dump has none; that value is 0. */
function omittedWait(value: unknown, label: string): number {
  return optionalInteger(value, label, 0);
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}
