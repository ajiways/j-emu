/**
 * AMF catalog dumps omit an integer field when the value is 0.
 * Named encoding rule, not a missing-data fallback. Use only for fields
 * where Pub1 evidence shows the zero is dropped (skill_flags, skill catalog
 * weight/order/group_id, action bonus_id).
 */
export function amfOmittedZeroInteger(value: unknown, label: string): number {
  if (value === undefined || value === null) return 0;
  return amfInteger(value, label);
}

/** AMF catalog dumps encode integers as numbers or decimal strings; empty string is 0. */
export function amfInteger(value: unknown, label: string): number {
  if (value === undefined || value === null) {
    throw new Error(`${label} is required`);
  }
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new Error(`${label} must be an integer`);
    return value;
  }
  if (typeof value === "string") {
    if (value === "") return 0;
    if (!/^-?\d+$/.test(value)) throw new Error(`${label} is not an integer: ${value}`);
    return Number(value);
  }
  throw new Error(`${label} must be an integer`);
}

export function amfActionParam(value: unknown, label: string): number | string {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new Error(`${label} must be an integer`);
    return value;
  }
  if (typeof value === "string") {
    if (/^-?\d+$/.test(value)) return Number(value);
    return value;
  }
  throw new Error(`${label} must be an integer or string`);
}

export function amfSpellSkillValue(value: unknown, label: string): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${label} is not a number`);
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`${label} is not a number: ${value}`);
    return parsed;
  }
  throw new Error(`${label} must be a number`);
}

export function amfNumber(value: unknown, label: string): number {
  if (value === undefined || value === null) throw new Error(`${label} is required`);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${label} is not a number`);
    return value;
  }
  if (typeof value === "string") {
    if (value === "") throw new Error(`${label} is required`);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`${label} is not a number: ${value}`);
    return parsed;
  }
  throw new Error(`${label} must be a number`);
}

export function amfGoldMinor(value: unknown, label: string): number {
  if (value === undefined || value === null) throw new Error(`${label} is required`);
  const gold = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(gold) || gold < 0) throw new Error(`${label} is not a gold amount`);
  const minor = Math.round(gold * 100);
  if (!Number.isInteger(minor) || minor < 0) throw new Error(`${label} cents overflow`);
  return minor;
}

export function amfString(value: unknown, label: string): string {
  if (value === undefined || value === null) throw new Error(`${label} is required`);
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

/** Pub1 omits `f_body` when the artikul has no Unity overlay. Empty string is authored. */
export function amfOmittedEmptyString(value: unknown, label: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
