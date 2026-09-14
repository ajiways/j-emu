import { amfInteger, isRecord } from "./amf-fields.ts";

export function idMapToList(raw: unknown, label: string): number[] {
  if (raw === undefined || raw === null) return [];
  if (Array.isArray(raw))
    return uniquePositiveIds(raw.map((value, index) => idFrom(value, `${label}[${index}]`)));
  if (!isRecord(raw)) throw new Error(`${label} must be an array or object map`);
  return uniquePositiveIds(Object.keys(raw).map((key) => idFrom(key, `${label} key`)));
}

function uniquePositiveIds(ids: readonly number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function idFrom(value: unknown, label: string): number {
  const id = amfInteger(value, label);
  if (id < 1) throw new Error(`${label} must be a positive id`);
  return id;
}
