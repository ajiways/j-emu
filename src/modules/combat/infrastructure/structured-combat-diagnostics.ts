import type { CombatDiagnostics, UnsupportedSkillReport } from "../ports/combat-diagnostics.ts";

/** One structured line per report (`event: "unsupported_skill"`). */
export class StructuredCombatDiagnostics implements CombatDiagnostics {
  constructor(private readonly write: (entry: Readonly<Record<string, unknown>>) => void) {}

  unsupportedSkill(report: UnsupportedSkillReport): void {
    this.write({ event: "unsupported_skill", ...report });
  }
}
