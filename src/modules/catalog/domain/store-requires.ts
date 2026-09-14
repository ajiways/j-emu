type RankStoreRequire = Readonly<{ type: "RANK"; min: number }>;
type ReputationStoreRequire = Readonly<{
  type: "REPUTATION";
  objectId: number;
  min: number;
}>;
type LevelStoreRequire = Readonly<{ type: "LEVEL"; min: number }>;
export type StoreRequire = RankStoreRequire | ReputationStoreRequire | LevelStoreRequire;

export type StoreRequires =
  Readonly<{ all: readonly StoreRequire[] }> | Readonly<{ any: readonly StoreRequire[] }>;

export function storeRequirePredicates(requires: StoreRequires): readonly StoreRequire[] {
  return "all" in requires ? requires.all : requires.any;
}

export function parseStoreRequires(raw: unknown): StoreRequires | null {
  if (raw === null || raw === undefined) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Store requires must be an object");
  }
  const row = raw as Record<string, unknown>;
  const keys = Object.keys(row);
  if (keys.length !== 1) throw new Error("Store requires has unknown fields");
  if (row.all !== undefined) {
    return { all: parseRequireList(row.all, "all") };
  }
  if (row.any !== undefined) {
    return { any: parseRequireList(row.any, "any") };
  }
  throw new Error("Store requires.all or requires.any is required");
}

function parseRequireList(raw: unknown, kind: "all" | "any"): StoreRequire[] {
  if (!Array.isArray(raw) || raw.length < 1) {
    throw new Error(`Store requires.${kind} must be a non-empty array`);
  }
  return raw.map((entry, index) => parseStoreRequire(entry, index));
}

function parseStoreRequire(raw: unknown, index: number): StoreRequire {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Store require ${index} must be an object`);
  }
  const row = raw as Record<string, unknown>;
  const type = row.type;
  if (type === "RANK") {
    const min = requireInt(row.min, `Store require ${index} RANK min is invalid`, 0);
    if (Object.keys(row).length !== 2)
      throw new Error(`Store require ${index} RANK has unknown fields`);
    return { type: "RANK", min };
  }
  if (type === "REPUTATION") {
    const objectId = requireInt(
      row.objectId !== undefined ? row.objectId : row.object_id,
      `Store require ${index} REPUTATION object_id is invalid`,
      1,
    );
    const min = requireInt(row.min, `Store require ${index} REPUTATION min is invalid`, 1);
    const keys = Object.keys(row);
    if (keys.length !== 3) throw new Error(`Store require ${index} REPUTATION has unknown fields`);
    return { type: "REPUTATION", objectId, min };
  }
  if (type === "LEVEL") {
    const min = requireInt(row.min, `Store require ${index} LEVEL min is invalid`, 1);
    if (Object.keys(row).length !== 2)
      throw new Error(`Store require ${index} LEVEL has unknown fields`);
    return { type: "LEVEL", min };
  }
  throw new Error(`Store require ${index} type ${String(type)} is not supported`);
}

function requireInt(value: unknown, message: string, min: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    throw new Error(message);
  }
  return value;
}
