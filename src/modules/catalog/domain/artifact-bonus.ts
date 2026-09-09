export class ArtifactBonus {
  constructor(
    readonly id: number,
    readonly kind: "skill",
    readonly skillId: string,
    readonly delta: number,
    readonly needValue: number,
    readonly artikulId: number,
    readonly title: string,
    readonly chatMsg: string,
  ) {
    if (!Number.isInteger(id) || id < 1) throw new Error("Bonus id is required");
    if (kind !== "skill") throw new Error(`Bonus ${id} kind must be skill`);
    if (!skillId) throw new Error(`Bonus ${id} skillId is required`);
    if (!Number.isInteger(delta) || delta === 0) {
      throw new Error(`Bonus ${id} delta must be a non-zero integer`);
    }
    if (!Number.isInteger(needValue) || needValue < 0) {
      throw new Error(`Bonus ${id} needValue is invalid`);
    }
    if (!Number.isInteger(artikulId) || artikulId < 1) {
      throw new Error(`Bonus ${id} artikulId is required`);
    }
    if (!title) throw new Error(`Bonus ${id} title is required`);
  }
}
