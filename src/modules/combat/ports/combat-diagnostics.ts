export type UnsupportedSkillReport = Readonly<{
  fightId: string;
  source: "pocket" | "glove" | "gear" | "bot";
  participantId: number;
  artikulId: number;
  title: string;
  skillId: string;
  effectKind: number;
}>;

export type UnsupportedEmblemReport = Readonly<{
  fightId: string;
  participantId: number;
  artikulId: number;
  title: string;
  reason: string;
}>;

/** Where combat reports what it could not do exactly; the fight carries on. */
export interface CombatDiagnostics {
  unsupportedSkill(report: UnsupportedSkillReport): void;
  /** An emblem the hero wears whose card combat cannot play yet; it does nothing in the fight. */
  unsupportedEmblem(report: UnsupportedEmblemReport): void;
}
