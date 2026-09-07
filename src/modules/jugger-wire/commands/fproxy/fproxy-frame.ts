import { ProtocolError } from "../../application/protocol-error.ts";

export function requireFightObject(frame: unknown): Record<string, unknown> {
  if (!frame || typeof frame !== "object" || Array.isArray(frame)) {
    throw new ProtocolError(204, "Fight command must be an object");
  }
  return frame as Record<string, unknown>;
}

export function fproxyCommandKey(frame: unknown): string {
  const rc = requireFightObject(frame)["rc"];
  if (typeof rc !== "string") {
    throw new ProtocolError(203, `Fight command ${String(rc)} is unsupported`);
  }
  return rc;
}
