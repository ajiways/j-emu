import { isRecord } from "./amf-fields.ts";

export function amfRecordList(raw: unknown, label: string): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.map((row, index) => requireRecord(row, `${label}[${index}]`));
  }
  if (!isRecord(raw)) throw new Error(`${label} must be an array or object map`);
  const rows: Record<string, unknown>[] = [];
  for (const [key, row] of Object.entries(raw)) {
    rows.push(requireRecord(row, `${label} ${key}`));
  }
  return rows;
}

function requireRecord(row: unknown, label: string): Record<string, unknown> {
  if (!isRecord(row)) throw new Error(`${label} must be an object`);
  return row;
}
