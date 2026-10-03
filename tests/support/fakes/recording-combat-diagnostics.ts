import type {
  CombatDiagnostics,
  UnsupportedEmblemReport,
  UnsupportedSkillReport,
} from "../../../src/modules/combat/ports/combat-diagnostics.ts";

export class RecordingCombatDiagnostics implements CombatDiagnostics {
  readonly unsupported: UnsupportedSkillReport[] = [];
  readonly unsupportedEmblems: UnsupportedEmblemReport[] = [];

  unsupportedSkill(report: UnsupportedSkillReport): void {
    this.unsupported.push(report);
  }

  unsupportedEmblem(report: UnsupportedEmblemReport): void {
    this.unsupportedEmblems.push(report);
  }
}
