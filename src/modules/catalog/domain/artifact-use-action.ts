export class ArtifactUseAction {
  constructor(
    readonly key: string,
    readonly code: string,
    readonly param1: number | string,
    readonly param2: number | string,
    readonly dispose: number,
    readonly title: string,
    readonly bonusId: number,
    readonly description: string,
  ) {
    if (!key) throw new Error("Artifact use action key is required");
    if (typeof code !== "string") {
      throw new Error(`Artifact use action ${key} code is required`);
    }
    if (typeof title !== "string") {
      throw new Error(`Artifact use action ${key} title is required`);
    }
    if (!Number.isInteger(bonusId) || bonusId < 0) {
      throw new Error(`Artifact use action ${key} bonusId is invalid`);
    }
    if (typeof description !== "string") {
      throw new Error(`Artifact use action ${key} description is required`);
    }
    if (!isActionParam(param1)) {
      throw new Error(`Artifact use action ${key} param1 is invalid`);
    }
    if (!isActionParam(param2)) {
      throw new Error(`Artifact use action ${key} param2 is invalid`);
    }
    if (dispose !== 0 && dispose !== 1) {
      throw new Error(`Artifact use action ${key} dispose is invalid`);
    }
  }
}

function isActionParam(value: number | string): boolean {
  if (typeof value === "string") return true;
  return Number.isInteger(value);
}
