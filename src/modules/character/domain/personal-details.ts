export class PersonalDetails {
  static readonly SCHEMA_VERSION = 1;
  static readonly MAX_JSON_BYTES = 16_384;

  private constructor(readonly info: Readonly<Record<string, unknown>>) {}

  static empty(): PersonalDetails {
    return new PersonalDetails({});
  }

  static fromStored(info: unknown): PersonalDetails {
    return new PersonalDetails(assertInfoObject(info, "stored personal details"));
  }

  merge(patch: Readonly<Record<string, unknown>>): PersonalDetails {
    const next: Record<string, unknown> = { ...this.info };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      next[key] = cloneJsonValue(value, key);
    }
    return new PersonalDetails(assertInfoObject(next, "merged personal details"));
  }
}

function assertInfoObject(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  const info: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    info[key] = cloneJsonValue(entry, key);
  }
  const encoded = JSON.stringify(info);
  const bytes = Buffer.byteLength(encoded, "utf8");
  if (bytes > PersonalDetails.MAX_JSON_BYTES) {
    throw new Error(`${label} exceed ${PersonalDetails.MAX_JSON_BYTES} bytes (${bytes})`);
  }
  return info;
}

function cloneJsonValue(value: unknown, path: string): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Personal details ${path} is not a finite number`);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => cloneJsonValue(entry, `${path}[${index}]`));
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue;
      result[key] = cloneJsonValue(entry, `${path}.${key}`);
    }
    return result;
  }
  throw new Error(`Personal details ${path} has unsupported type ${typeof value}`);
}
