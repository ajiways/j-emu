import type { ReputationTrackDocument } from "../../src/modules/content/domain/content-playable-entities.ts";
import { SUM_REPUTATION_OBJECT_ID } from "../../src/modules/catalog/domain/reputation-ids.ts";
import {
  isRecord,
  rejectUnknownKeys,
  requireInteger,
  requireNonemptyString,
  requireString,
} from "./json-object-keys.ts";

const ROOT_KEYS = new Set(["note", "tracks"]);
const TRACK_KEYS = new Set(["object_id", "type", "title", "image", "unlock_flag"]);

export function reputationTracksFromJson(raw: unknown): ReputationTrackDocument[] {
  if (!isRecord(raw)) throw new Error("reputation-tracks root must be an object");
  rejectUnknownKeys(raw, ROOT_KEYS, "reputation-tracks");
  requireString(raw.note, "reputation-tracks note");
  if (!Array.isArray(raw.tracks)) throw new Error("reputation-tracks.tracks must be an array");
  const tracks: ReputationTrackDocument[] = [];
  const seen = new Set<number>();
  for (const row of raw.tracks) {
    if (!isRecord(row)) throw new Error("reputation track must be an object");
    rejectUnknownKeys(row, TRACK_KEYS, "reputation track");
    const objectId = requireInteger(row.object_id, "reputation track object_id");
    if (objectId < 1) throw new Error("reputation track object_id must be positive");
    if (seen.has(objectId)) throw new Error(`Duplicate reputation track ${objectId}`);
    seen.add(objectId);
    const type = requireInteger(row.type, `reputation track ${objectId} type`);
    if (objectId === SUM_REPUTATION_OBJECT_ID || type === 3) {
      if (objectId !== SUM_REPUTATION_OBJECT_ID || type !== 3) {
        throw new Error(`reputation track ${objectId} type ${type} is not a derived SUM`);
      }
      continue;
    }
    if (type !== 2) throw new Error(`reputation track ${objectId} type ${type} is not supported`);
    const unlockFlag =
      row.unlock_flag === undefined
        ? ""
        : requireString(row.unlock_flag, `reputation track ${objectId} unlock_flag`);
    tracks.push({
      objectId,
      type: 2,
      title: requireNonemptyString(row.title, `reputation track ${objectId} title`),
      image: requireNonemptyString(row.image, `reputation track ${objectId} image`),
      unlockFlag,
    });
  }
  if (!tracks.some((track) => track.objectId === 5)) {
    throw new Error("reputation track 5 is required");
  }
  return tracks;
}
