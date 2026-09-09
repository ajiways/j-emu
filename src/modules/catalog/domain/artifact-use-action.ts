export class ArtifactUseAction {
  constructor(
    readonly key: string,
    readonly code: string,
    readonly param1: number,
    readonly param2: number,
    readonly dispose: number,
    readonly title: string,
  ) {
    if (!key) throw new Error("Artifact use action key is required");
    if (!code) throw new Error(`Artifact use action ${key} code is required`);
    if (!title) throw new Error(`Artifact use action ${key} title is required`);
    if (!Number.isInteger(param1) || param1 < 0) {
      throw new Error(`Artifact use action ${key} param1 is invalid`);
    }
    if (!Number.isInteger(param2) || param2 < 0) {
      throw new Error(`Artifact use action ${key} param2 is invalid`);
    }
    if (dispose !== 0 && dispose !== 1) {
      throw new Error(`Artifact use action ${key} dispose is invalid`);
    }
  }
}
