import { ProtocolError } from "../../application/protocol-error.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export function artifactInstanceIdFrom(envelope: ObjectActionEnvelope): number {
  const form = envelope.form;
  if (!form) throw new ProtocolError(203, "common|object requires form");
  const raw = form["artifact_id"] ?? form["object_id"];
  if (typeof raw !== "number" && typeof raw !== "string") {
    throw new ProtocolError(203, "PUT_ON/PUT_OFF requires artifact_id");
  }
  const itemId = Number(raw);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    throw new ProtocolError(203, "PUT_ON/PUT_OFF artifact_id is invalid");
  }
  return itemId;
}
