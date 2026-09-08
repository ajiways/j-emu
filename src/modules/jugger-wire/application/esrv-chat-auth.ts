import { decodeAmf3 } from "../amf/amf3.ts";

export function isChatAuth(body: unknown): boolean {
  if (!Buffer.isBuffer(body) || body.length < 4) return false;
  try {
    const decoded = decodeAmf3(body);
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return false;
    return decoded.rc === "auth" && Number(decoded.eid) === 1;
  } catch {
    return false;
  }
}
