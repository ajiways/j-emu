export class ArtifactDefinition {
  constructor(
    readonly id: number,
    readonly title: string,
    readonly picture: string,
    readonly typeId: string,
    readonly kindId: number,
    readonly slotMask: number,
    readonly weight: number,
  ) {
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid artifact id");
  }
}
