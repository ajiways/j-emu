import { PocketDeniedError } from "../../../inventory/domain/pocket-denied-error.ts";
import { SLOT_EFFECT } from "../../../inventory/domain/pocket-slot.ts";
import type { PocketTarget } from "../../../inventory/domain/put-on-pocket.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export function pocketTargetFromEnvelope(envelope: ObjectActionEnvelope): PocketTarget | undefined {
  const raw = envelope.input?.["slot_num"] ?? envelope.form?.["slot_num"];
  if (raw === undefined || raw === null) return undefined;
  const value = typeof raw === "number" || typeof raw === "string" ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value)) throw PocketDeniedError.notWearable();
  if (value === 0) return undefined;
  if (value === SLOT_EFFECT) return "auto";
  if (!Number.isInteger(value) || value < 1) throw PocketDeniedError.notWearable();
  return value;
}
