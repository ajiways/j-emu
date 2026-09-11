import { ProtocolError } from "../../application/protocol-error.ts";

const OA_ENVELOPE = new Set(["object", "action", "form", "in", "sq", "sess_key"]);

export type ObjectActionEnvelope = Readonly<{
  object: string;
  action: string;
  form?: Readonly<Record<string, unknown>>;
  input?: Readonly<Record<string, unknown>>;
  root?: Readonly<Record<string, unknown>>;
  sequence: string | number | boolean | null;
}>;

export function decodeObjectActionEnvelope(value: unknown): ObjectActionEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProtocolError(204, "AMF object-action payload must be an object");
  }
  const record = value as Record<string, unknown>;
  const object = record["object"];
  const action = record["action"];
  const sequence = record["sq"];
  if (typeof object !== "string" || typeof action !== "string" || sequence === undefined) {
    throw new ProtocolError(204, "AMF object, action and sq are required");
  }
  if (
    sequence !== null &&
    typeof sequence !== "string" &&
    typeof sequence !== "number" &&
    typeof sequence !== "boolean"
  ) {
    throw new ProtocolError(204, "AMF sq must be a scalar");
  }
  const form = optionalObject(record["form"], "form");
  const input = optionalObject(record["in"], "in");
  const root = extraRoot(record);
  return {
    object,
    action,
    sequence,
    ...(form ? { form } : {}),
    ...(input ? { input } : {}),
    ...(root ? { root } : {}),
  };
}

function extraRoot(record: Record<string, unknown>): Readonly<Record<string, unknown>> | undefined {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (OA_ENVELOPE.has(key) || value === undefined || value === null) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function oaRegistryKey(envelope: ObjectActionEnvelope): string {
  if (isCommonObjectMutation(envelope)) {
    if (!envelope.form) throw new ProtocolError(203, "common|object requires form");
    const code = envelope.form["code"];
    if (code === undefined || code === null || code === "") {
      if (envelope.form["object_class"] === "ARTIFACT") return "common|object:USE";
      if (envelope.form["object_class"] === "AREA") return "common|object:AREA";
      throw new ProtocolError(203, "common|object requires code");
    }
    if (typeof code !== "string" && typeof code !== "number") {
      throw new ProtocolError(203, "common|object code is invalid");
    }
    return `common|object:${code}`;
  }
  return `${envelope.object}|${envelope.action}`;
}

export function oaResponseKey(envelope: ObjectActionEnvelope): string {
  if (isCommonObjectMutation(envelope)) return "common|action";
  return `${envelope.object}|${envelope.action}`;
}

function isCommonObjectMutation(envelope: ObjectActionEnvelope): boolean {
  return (
    envelope.object === "common" && (envelope.action === "object" || envelope.action === "action")
  );
}

function optionalObject(
  value: unknown,
  field: string,
): Readonly<Record<string, unknown>> | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    if (value.length === 0) return {};
    throw new ProtocolError(204, `AMF ${field} must not contain dense array values`);
  }
  if (typeof value !== "object") {
    throw new ProtocolError(204, `AMF ${field} must be an object`);
  }
  return value as Record<string, unknown>;
}
