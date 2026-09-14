import type {
  StoreLotDocument,
  StoreTypeDocument,
} from "../../src/modules/content/domain/content-playable-entities.ts";
import { parseStoreRequires } from "../../src/modules/catalog/domain/store-requires.ts";
import {
  isRecord,
  rejectUnknownKeys,
  requireInteger,
  requireNonemptyString,
  requireString,
} from "./json-object-keys.ts";
import { storeLotPayFromDump } from "./store-lot-pay-policy.ts";

const STORE_ROOT_KEYS = new Set(["area_id", "title", "types", "artikuls", "entries"]);
const TYPE_KEYS = new Set(["id", "title", "ord"]);
const LOT_KEYS = new Set(["id", "lot_id", "type_id", "price", "badge_data", "requires"]);

export function storeFromDump(
  raw: unknown,
  fileLabel: string,
): {
  types: StoreTypeDocument[];
  lots: StoreLotDocument[];
} {
  if (!isRecord(raw)) throw new Error(`${fileLabel} root must be an object`);
  rejectUnknownKeys(raw, STORE_ROOT_KEYS, fileLabel);
  const areaId =
    typeof raw.area_id === "number"
      ? String(raw.area_id)
      : requireNonemptyString(raw.area_id, `${fileLabel} area_id`);
  if (!/^[1-9][0-9]*$/.test(areaId)) throw new Error(`${fileLabel} area_id is not a wire area id`);
  requireString(raw.title, `${fileLabel} title`);
  const types = typesFromDump(raw.types, areaId, fileLabel);
  const lots = lotsFromDump(raw.artikuls, areaId, fileLabel);
  const typeIds = new Set(types.map((row) => row.typeId));
  const usedTypes = new Set(lots.map((lot) => lot.typeId));
  for (const type of types) {
    if (!usedTypes.has(type.typeId)) {
      throw new Error(`store ${areaId} type ${type.typeId} has no lots`);
    }
  }
  for (const lot of lots) {
    if (!typeIds.has(lot.typeId)) {
      throw new Error(`store ${areaId} lot ${lot.lotId} type ${lot.typeId} is missing`);
    }
  }
  return { types, lots };
}

function typesFromDump(raw: unknown, areaId: string, fileLabel: string): StoreTypeDocument[] {
  const rows = Array.isArray(raw) ? raw : isRecord(raw) ? Object.values(raw) : null;
  if (!rows) throw new Error(`${fileLabel} types must be an array or object`);
  const types: StoreTypeDocument[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    if (!isRecord(row)) throw new Error(`store ${areaId} type must be an object`);
    rejectUnknownKeys(row, TYPE_KEYS, `store ${areaId} type`);
    const typeId = requireInteger(row.id, `store ${areaId} type id`);
    if (seen.has(typeId)) throw new Error(`Duplicate store_type ${areaId}:${typeId}`);
    seen.add(typeId);
    types.push({
      areaId,
      typeId,
      title: requireNonemptyString(row.title, `store ${areaId} type ${typeId} title`),
      ord: requireInteger(row.ord, `store ${areaId} type ${typeId} ord`),
    });
  }
  if (types.length < 1) throw new Error(`store ${areaId} has no types`);
  return types;
}

function lotsFromDump(raw: unknown, areaId: string, fileLabel: string): StoreLotDocument[] {
  if (!Array.isArray(raw)) throw new Error(`${fileLabel} artikuls must be an array`);
  const lots: StoreLotDocument[] = [];
  const seen = new Set<number>();
  for (const [ord, row] of raw.entries()) {
    if (!isRecord(row)) throw new Error(`store ${areaId} lot must be an object`);
    rejectUnknownKeys(row, LOT_KEYS, `store ${areaId} lot`);
    const artikulId = requireInteger(row.id, `store ${areaId} artikul id`);
    if (artikulId < 1) throw new Error(`store ${areaId} artikul id must be positive`);
    const dumpLotId = requireInteger(row.lot_id, `store ${areaId} artikul ${artikulId} lot_id`);
    if (dumpLotId < 0) throw new Error(`store ${areaId} artikul ${artikulId} lot_id is invalid`);
    const lotId = dumpLotId === 0 ? artikulId : dumpLotId;
    if (seen.has(lotId)) throw new Error(`Duplicate store_lot ${areaId}:${lotId}`);
    seen.add(lotId);
    const { price, pay } = storeLotPayFromDump(areaId, artikulId, row.price, row.badge_data);
    const lot: StoreLotDocument = {
      areaId,
      lotId,
      artikulId,
      typeId: requireInteger(row.type_id, `store ${areaId} artikul ${artikulId} type_id`),
      price,
      ord,
      pay,
    };
    if (row.requires !== undefined) {
      const requires = parseStoreRequires(row.requires);
      if (!requires) throw new Error(`store ${areaId} lot ${lotId} requires is required`);
      lots.push({ ...lot, requires });
    } else {
      lots.push(lot);
    }
  }
  if (lots.length < 1) throw new Error(`store ${areaId} has no lots`);
  return lots;
}
