import type { DungeonDocument } from "../../src/modules/content/domain/content-dungeon.ts";
import {
  DUMP_HUNT_MASK,
  DUMP_SPAWN_WAIT_MAX,
  DUMP_SPAWN_WAIT_MIN,
} from "./dungeon-spawn-defaults.ts";
import {
  isRecord,
  rejectUnknownKeys,
  requireInteger,
  requireNonemptyString,
} from "./json-object-keys.ts";

const SPAWN_KEYS = new Set([
  "spawn_key",
  "hunt_bot_id",
  "encounter",
  "is_boss",
  "counts_for_clear",
  "hunt_mask",
  "position_x",
  "position_y",
  "wait_min",
  "wait_max",
  "zone",
  "route",
]);
const ENCOUNTER_KEYS = new Set(["bot_id", "count"]);
const ROUTE_KEYS = new Set(["x", "y", "wait_min", "wait_max"]);
const ZONE_KEYS = new Set(["x", "y"]);

type DungeonSpawnDocument = DungeonDocument["areas"][number]["spawns"][number];

export function spawnsFromJson(raw: unknown, label: string): DungeonSpawnDocument[] {
  if (!Array.isArray(raw) || raw.length < 1) throw new Error(`${label} has no spawns`);
  const spawns: DungeonSpawnDocument[] = [];
  const seen = new Set<string>();
  for (const [index, value] of raw.entries()) {
    if (!isRecord(value)) throw new Error(`${label} spawns[${index}] must be an object`);
    rejectUnknownKeys(value, SPAWN_KEYS, `${label} spawns[${index}]`);
    const spawnKey = requireNonemptyString(value.spawn_key, `${label} spawns[${index}] spawn_key`);
    if (seen.has(spawnKey)) throw new Error(`${label} has duplicate spawn_key ${spawnKey}`);
    seen.add(spawnKey);
    const waitMin = omittedWait(
      value.wait_min,
      `${label} spawn ${spawnKey} wait_min`,
      DUMP_SPAWN_WAIT_MIN,
    );
    const waitMax = omittedWait(
      value.wait_max,
      `${label} spawn ${spawnKey} wait_max`,
      DUMP_SPAWN_WAIT_MAX,
    );
    if (waitMax < waitMin) throw new Error(`${label} spawn ${spawnKey} wait max is below min`);
    spawns.push({
      spawnKey,
      huntBotId: requirePositive(value.hunt_bot_id, `${label} spawn ${spawnKey} hunt_bot_id`),
      encounter: encountersFromJson(value.encounter, `${label} spawn ${spawnKey}`),
      isBoss: requireBoolean(value.is_boss, `${label} spawn ${spawnKey} is_boss`),
      countsForClear: requireBoolean(
        value.counts_for_clear,
        `${label} spawn ${spawnKey} counts_for_clear`,
      ),
      huntMask: omittedHuntMask(value.hunt_mask, `${label} spawn ${spawnKey} hunt_mask`),
      positionX: requireInteger(value.position_x, `${label} spawn ${spawnKey} position_x`),
      positionY: requireInteger(value.position_y, `${label} spawn ${spawnKey} position_y`),
      waitMin,
      waitMax,
      zone: zoneFromJson(value.zone, `${label} spawn ${spawnKey}`),
      route: routeFromJson(value.route, `${label} spawn ${spawnKey}`),
    });
  }
  return spawns;
}

function encountersFromJson(raw: unknown, label: string): DungeonSpawnDocument["encounter"] {
  if (!Array.isArray(raw) || raw.length < 1) throw new Error(`${label} has no encounter`);
  return raw.map((value, index) => {
    if (!isRecord(value)) throw new Error(`${label} encounter[${index}] must be an object`);
    rejectUnknownKeys(value, ENCOUNTER_KEYS, `${label} encounter[${index}]`);
    return {
      botId: requirePositive(value.bot_id, `${label} encounter[${index}] bot_id`),
      count: requirePositive(value.count, `${label} encounter[${index}] count`),
    };
  });
}

function zoneFromJson(raw: unknown, label: string): DungeonSpawnDocument["zone"] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error(`${label} zone must be an array`);
  return raw.map((value, index) => {
    if (!isRecord(value)) throw new Error(`${label} zone[${index}] must be an object`);
    rejectUnknownKeys(value, ZONE_KEYS, `${label} zone[${index}]`);
    return {
      x: requireInteger(value.x, `${label} zone[${index}] x`),
      y: requireInteger(value.y, `${label} zone[${index}] y`),
    };
  });
}

function routeFromJson(raw: unknown, label: string): DungeonSpawnDocument["route"] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error(`${label} route must be an array`);
  return raw.map((value, index) => {
    if (!isRecord(value)) throw new Error(`${label} route[${index}] must be an object`);
    rejectUnknownKeys(value, ROUTE_KEYS, `${label} route[${index}]`);
    const waitMin = omittedWait(
      value.wait_min,
      `${label} route[${index}] wait_min`,
      DUMP_SPAWN_WAIT_MIN,
    );
    const waitMax = omittedWait(
      value.wait_max,
      `${label} route[${index}] wait_max`,
      DUMP_SPAWN_WAIT_MAX,
    );
    if (waitMax < waitMin) throw new Error(`${label} route[${index}] wait max is below min`);
    return {
      x: requireInteger(value.x, `${label} route[${index}] x`),
      y: requireInteger(value.y, `${label} route[${index}] y`),
      waitMin,
      waitMax,
    };
  });
}

function omittedHuntMask(raw: unknown, label: string): string {
  if (raw === undefined) return DUMP_HUNT_MASK;
  return requireNonemptyString(raw, label);
}

function omittedWait(raw: unknown, label: string, dumpValue: number): number {
  if (raw === undefined) return dumpValue;
  const wait = requireInteger(raw, label);
  if (wait < 0) throw new Error(`${label} is invalid`);
  return wait;
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
