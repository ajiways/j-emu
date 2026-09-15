import { CatalogOperatorError } from "../../application/catalog-operator-error.ts";

const WIRE_INTEGER_MAX = 2_147_483_647;
const IDS_MAX = 64;

export function parseArtifactId(raw: string): number {
  if (!/^[1-9]\d*$/.test(raw)) throw new CatalogOperatorError(400, "artifact id is invalid");
  const id = Number(raw);
  if (!Number.isInteger(id) || id > WIRE_INTEGER_MAX) {
    throw new CatalogOperatorError(400, "artifact id is invalid");
  }
  return id;
}

export function parseCatalogListQuery(query: unknown): {
  q?: string;
  ids?: readonly number[];
} {
  if (query === undefined || query === null || typeof query !== "object" || Array.isArray(query)) {
    throw new CatalogOperatorError(400, "query is invalid");
  }
  const record = query as Record<string, unknown>;
  const unknownKey = Object.keys(record).find((key) => key !== "q" && key !== "ids");
  if (unknownKey !== undefined) {
    throw new CatalogOperatorError(400, `${unknownKey}: unknown query field`);
  }
  const q = optionalString(record.q, "q");
  const ids = optionalIds(record.ids);
  if (q !== undefined && ids !== undefined) {
    throw new CatalogOperatorError(400, "q and ids cannot be combined");
  }
  return {
    ...(q === undefined ? {} : { q }),
    ...(ids === undefined ? {} : { ids }),
  };
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new CatalogOperatorError(400, `${name} must be a string`);
  return value;
}

function optionalIds(value: unknown): readonly number[] | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new CatalogOperatorError(400, "ids must be a comma-separated list of artifact ids");
  }
  const parts = value.split(",");
  if (parts.length > IDS_MAX) {
    throw new CatalogOperatorError(400, `ids cannot contain more than ${IDS_MAX} values`);
  }
  return parts.map((part) => parseArtifactId(part.trim()));
}
