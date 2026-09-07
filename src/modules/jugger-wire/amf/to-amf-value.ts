import type { AmfValue } from "./amf3.ts";

export function toAmfValue(value: unknown): AmfValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("AMF number must be finite");
    return value;
  }
  if (Array.isArray(value)) return value.map(toAmfValue);
  if (typeof value === "object") {
    const result: Record<string, AmfValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) throw new Error(`AMF object key ${key} is undefined`);
      result[key] = toAmfValue(entry);
    }
    return result;
  }
  throw new Error(`Unsupported AMF value type ${typeof value}`);
}
