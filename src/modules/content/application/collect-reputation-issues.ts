import {
  RADVEY_REPUTATION_OBJECT_ID,
  SUM_REPUTATION_OBJECT_ID,
} from "../../catalog/domain/reputation-ids.ts";
import type { ContentBundle } from "../domain/content-document.ts";

const RADVEY_TITLE = "Репутация Радвея";
const RADVEY_IMAGE = "rep_radvey_sm.png";
const SLICE_EXCLUDED_OBJECT_IDS = new Set([SUM_REPUTATION_OBJECT_ID]);

export function collectReputationIssues(bundle: ContentBundle): readonly string[] {
  const issues: string[] = [];
  const seen = new Set<number>();
  for (const track of bundle.reputationTracks) {
    if (seen.has(track.objectId)) {
      issues.push(`duplicate reputation track id ${track.objectId}`);
    }
    seen.add(track.objectId);
    if (SLICE_EXCLUDED_OBJECT_IDS.has(track.objectId)) {
      issues.push(`reputation track ${track.objectId} is not in the playable slice`);
    }
  }
  const radvey = bundle.reputationTracks.find(
    (track) => track.objectId === RADVEY_REPUTATION_OBJECT_ID,
  );
  if (!radvey) {
    issues.push(`reputation track ${RADVEY_REPUTATION_OBJECT_ID} is required`);
    return issues;
  }
  if (radvey.type !== 2) {
    issues.push(`reputation track ${RADVEY_REPUTATION_OBJECT_ID} type must be 2`);
  }
  if (radvey.title !== RADVEY_TITLE) {
    issues.push(`reputation track ${RADVEY_REPUTATION_OBJECT_ID} title must be ${RADVEY_TITLE}`);
  }
  if (radvey.image !== RADVEY_IMAGE) {
    issues.push(`reputation track ${RADVEY_REPUTATION_OBJECT_ID} image must be ${RADVEY_IMAGE}`);
  }
  if (radvey.unlockFlag !== "") {
    issues.push(`reputation track ${RADVEY_REPUTATION_OBJECT_ID} unlockFlag must be empty`);
  }
  return issues;
}
