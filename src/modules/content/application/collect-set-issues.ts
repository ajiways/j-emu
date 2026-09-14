import { ARTIFACT_KIND_SET_BONUS } from "../../catalog/domain/artifact-kind.ts";
import type { ContentBundle } from "../domain/content-document.ts";

const RECRUIT_SET_ID = 47;
const REQUIRED_SET_PIECES = [
  { id: 27, title: "Палица рекрута", setId: RECRUIT_SET_ID, trend: 0 },
  { id: 28, title: "Шлем рекрута", setId: RECRUIT_SET_ID, trend: 0 },
  { id: 30, title: "Кираса рекрута", setId: RECRUIT_SET_ID, trend: 0 },
  { id: 33, title: "Перчатка рекрута", setId: RECRUIT_SET_ID, trend: 0 },
  { id: 35, title: "Поножи рекрута", setId: RECRUIT_SET_ID, trend: 0 },
  { id: 43, title: "Перчатка убийцы", setId: 48, trend: 1 },
  { id: 46, title: "Шлем стража", setId: 49, trend: 3 },
] as const;

const REQUIRED_BONUS = {
  id: 106,
  title: "Комплект рекрута - 5 вещей",
} as const;

export function collectSetIssues(bundle: ContentBundle): readonly string[] {
  const issues: string[] = [];
  const byId = new Map(bundle.artifacts.map((artifact) => [artifact.id, artifact]));
  if (!bundle.skills.some((skill) => skill.id === "MAGSTR")) {
    issues.push("missing required set skill MAGSTR");
  }
  for (const spec of REQUIRED_SET_PIECES) {
    const artifact = byId.get(spec.id);
    if (!artifact) {
      issues.push(`set piece ${spec.id} is missing`);
      continue;
    }
    if (artifact.title !== spec.title) {
      issues.push(`set piece ${spec.id} title must be ${spec.title}`);
    }
    if (artifact.extra.trend !== spec.trend) {
      issues.push(`set piece ${spec.id} trend must be ${spec.trend}`);
    }
    if (artifact.extra.set?.id !== spec.setId) {
      issues.push(`set piece ${spec.id} extra.set.id must be ${spec.setId}`);
    }
  }
  const bonus = byId.get(REQUIRED_BONUS.id);
  if (!bonus) {
    issues.push(`set bonus ${REQUIRED_BONUS.id} is missing`);
  } else {
    if (bonus.title !== REQUIRED_BONUS.title) {
      issues.push(`set bonus ${REQUIRED_BONUS.id} title must be ${REQUIRED_BONUS.title}`);
    }
    if (bonus.kindId !== ARTIFACT_KIND_SET_BONUS) {
      issues.push(`set bonus ${REQUIRED_BONUS.id} kindId must be ${ARTIFACT_KIND_SET_BONUS}`);
    }
    if (bonus.typeId !== "9") issues.push(`set bonus ${REQUIRED_BONUS.id} typeId must be 9`);
    if (bonus.picture) issues.push(`set bonus ${REQUIRED_BONUS.id} picture must be empty`);
    if (bonus.slotMask !== 0) issues.push(`set bonus ${REQUIRED_BONUS.id} slotMask must be 0`);
  }
  const pieceCountBySet = new Map<number, number>();
  for (const artifact of bundle.artifacts) {
    const setId = artifact.extra.set?.id;
    if (!setId || artifact.kindId === ARTIFACT_KIND_SET_BONUS) continue;
    const current = pieceCountBySet.get(setId);
    if (current === undefined) pieceCountBySet.set(setId, 1);
    else pieceCountBySet.set(setId, current + 1);
  }
  for (const artifact of bundle.artifacts) {
    const set = artifact.extra.set;
    if (!set) continue;
    const worn = pieceCountBySet.get(set.id);
    if (worn === undefined) continue;
    for (const [key, raw] of Object.entries(set)) {
      const match = /^bonus([1-9])$/.exec(key);
      if (!match || typeof raw !== "number" || raw < 1) continue;
      const count = Number(match[1]);
      if (worn < count) continue;
      const bonusArtikul = byId.get(raw);
      if (!bonusArtikul) {
        issues.push(`set ${set.id} bonus${count} artikul ${raw} is missing`);
        continue;
      }
      if (bonusArtikul.kindId !== ARTIFACT_KIND_SET_BONUS) {
        issues.push(`set ${set.id} bonus${count} artikul ${raw} kindId must be 139`);
      }
    }
  }
  return issues;
}
