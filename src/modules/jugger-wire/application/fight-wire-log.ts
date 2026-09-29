import type { FightWireFrame } from "./fight-wire-event.ts";

const EVENT_KEYS = [
  "et",
  "persId",
  "targetId",
  "sourceId",
  "artikulId",
  "id",
  "effectId",
  "kind",
  "remainTime",
  "animData",
  "hp",
  "react",
  "dmgType",
  "restTime",
  "span",
] as const;

/** Compact view of the fight frames sent to a client, for the request log. */
export function summarizeFightFrames(
  frames: readonly (FightWireFrame | Readonly<Record<string, unknown>>)[],
): readonly Readonly<Record<string, unknown>>[] {
  const rows: Record<string, unknown>[] = [];
  for (const frame of frames) {
    const ev = "ev" in frame ? frame.ev : undefined;
    if (!ev || typeof ev !== "object") {
      rows.push({ ...frame });
      continue;
    }
    for (const event of Object.values(ev)) rows.push(pickEventFields(event));
  }
  return rows;
}

function pickEventFields(event: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of EVENT_KEYS) {
    if (event[key] !== undefined) row[key] = event[key];
  }
  return row;
}
