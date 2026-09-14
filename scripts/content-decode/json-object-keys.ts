export function rejectUnknownKeys(
  record: Readonly<Record<string, unknown>>,
  allowed: ReadonlySet<string>,
  label: string,
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new Error(`${label} has unknown field ${key}`);
  }
}

export function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

export function requireNonemptyString(value: unknown, label: string): string {
  const text = requireString(value, label);
  if (!text) throw new Error(`${label} is required`);
  return text;
}

export function requireInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
  return value;
}

export function optionalInteger(value: unknown, label: string, fallback: number): number {
  if (value === undefined) return fallback;
  return requireInteger(value, label);
}

export function requireFlag(value: unknown, label: string): 0 | 1 {
  const flag = optionalInteger(value, label, 0);
  if (flag !== 0 && flag !== 1) throw new Error(`${label} must be 0 or 1`);
  return flag;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
