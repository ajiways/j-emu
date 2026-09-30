import type {
  CombatDiagnostics,
  UnsupportedSkillReport,
} from "../../../src/modules/combat/ports/combat-diagnostics.ts";

export class RecordingCombatDiagnostics implements CombatDiagnostics {
  readonly unsupported: UnsupportedSkillReport[] = [];

  unsupportedSkill(report: UnsupportedSkillReport): void {
    this.unsupported.push(report);
  }
}
