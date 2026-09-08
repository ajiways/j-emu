export class ArtifactSkillBonus {
  constructor(
    readonly id: string,
    readonly value: number,
    readonly flags: number,
  ) {
    if (!id) throw new Error("Artifact skill id is required");
    if (!Number.isInteger(value)) throw new Error(`Artifact skill ${id} value is invalid`);
    if (!Number.isInteger(flags) || flags < 0) {
      throw new Error(`Artifact skill ${id} flags are invalid`);
    }
  }
}
