export const PROGRESSION_MANAGED_SKILL_IDS = ["STR", "RAG", "DEX", "DEF", "VIT", "MPMAX"] as const;

export type ProgressionManagedSkillId = (typeof PROGRESSION_MANAGED_SKILL_IDS)[number];

const PROGRESSION_EVIDENCE_KINDS = ["confirmed", "legacy_extrapolated"] as const;

export type ProgressionEvidenceKind = (typeof PROGRESSION_EVIDENCE_KINDS)[number];

export function isProgressionManagedSkillId(id: string): id is ProgressionManagedSkillId {
  return (PROGRESSION_MANAGED_SKILL_IDS as readonly string[]).includes(id);
}

export function isProgressionEvidenceKind(value: string): value is ProgressionEvidenceKind {
  return (PROGRESSION_EVIDENCE_KINDS as readonly string[]).includes(value);
}
