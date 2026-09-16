export type GloveInstanceSpell = Readonly<{
  artikul_id: number;
  cost: number;
  row: number;
}>;

export type ItemInstanceData = Readonly<{
  hits?: readonly number[];
  spells?: readonly GloveInstanceSpell[];
}>;

export const EMPTY_ITEM_INSTANCE: ItemInstanceData = {};

export function isRolledGloveInstance(
  data: ItemInstanceData,
  socketCount: number,
): data is ItemInstanceData & {
  hits: readonly number[];
  spells: readonly GloveInstanceSpell[];
} {
  return (
    socketCount >= 1 &&
    Array.isArray(data.hits) &&
    data.hits.length === 8 &&
    Array.isArray(data.spells) &&
    data.spells.length === socketCount
  );
}

export function requireItemInstanceData(value: unknown, label: string): ItemInstanceData {
  if (value === undefined || value === null) {
    throw new Error(`${label} is required`);
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "hits" && key !== "spells") {
      throw new Error(`${label} has unknown key ${key}`);
    }
  }
  return {
    ...(record.hits === undefined ? {} : { hits: hitsFromJson(record.hits, label) }),
    ...(record.spells === undefined ? {} : { spells: spellsFromJson(record.spells, label) }),
  };
}

function hitsFromJson(value: unknown, label: string): readonly number[] {
  if (!Array.isArray(value) || value.length !== 8) {
    throw new Error(`${label} hits must contain 8 L/C/R steps`);
  }
  return value.map((hit, index) => {
    if (hit !== 1 && hit !== 2 && hit !== 3) {
      throw new Error(`${label} hits[${index}] must be 1, 2 or 3`);
    }
    return hit;
  });
}

function spellsFromJson(value: unknown, label: string): readonly GloveInstanceSpell[] {
  if (!Array.isArray(value) || value.length < 1) {
    throw new Error(`${label} spells must be a nonempty array`);
  }
  return value.map((spell, index) => {
    if (!spell || typeof spell !== "object" || Array.isArray(spell)) {
      throw new Error(`${label} spells[${index}] is invalid`);
    }
    const row = spell as Record<string, unknown>;
    if (
      typeof row.artikul_id !== "number" ||
      !Number.isInteger(row.artikul_id) ||
      row.artikul_id < 1
    ) {
      throw new Error(`${label} spells[${index}] artikul_id is required`);
    }
    if (typeof row.cost !== "number" || !Number.isInteger(row.cost) || row.cost < 1) {
      throw new Error(`${label} spells[${index}] cost is required`);
    }
    if (typeof row.row !== "number" || !Number.isInteger(row.row) || row.row < 1) {
      throw new Error(`${label} spells[${index}] row is required`);
    }
    return { artikul_id: row.artikul_id, cost: row.cost, row: row.row };
  });
}
