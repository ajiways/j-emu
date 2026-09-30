export type UnsupportedSkillReport = Readonly<{
  fightId: string;
  source: "pocket" | "glove" | "gear" | "bot";
  participantId: number;
  artikulId: number;
  title: string;
  skillId: string;
  effectKind: number;
}>;

/** Where combat reports what it could not do exactly; the fight carries on. */
export interface CombatDiagnostics {
  unsupportedSkill(report: UnsupportedSkillReport): void;
}
