import { ArtifactUseAction } from "../domain/artifact-use-action.ts";

export function artifactUseActionsFromJson(
  artifactId: number,
  value: unknown,
): Readonly<Record<string, ArtifactUseAction>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Artifact ${artifactId} artifact_actions must be an object`);
  }
  const record = value as Record<string, unknown>;
  const actions: Record<string, ArtifactUseAction> = {};
  for (const [key, raw] of Object.entries(record)) {
    actions[key] = actionFromJson(artifactId, key, raw);
  }
  return actions;
}

function actionFromJson(artifactId: number, key: string, value: unknown): ArtifactUseAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Artifact ${artifactId} use action ${key} must be an object`);
  }
  const record = value as Record<string, unknown>;
  if (typeof record["code"] !== "string") {
    throw new Error(`Artifact ${artifactId} use action ${key} code is required`);
  }
  if (typeof record["title"] !== "string") {
    throw new Error(`Artifact ${artifactId} use action ${key} title is required`);
  }
  if (typeof record["param1"] !== "number") {
    throw new Error(`Artifact ${artifactId} use action ${key} param1 is required`);
  }
  if (typeof record["param2"] !== "number") {
    throw new Error(`Artifact ${artifactId} use action ${key} param2 is required`);
  }
  if (typeof record["dispose"] !== "number") {
    throw new Error(`Artifact ${artifactId} use action ${key} dispose is required`);
  }
  const bonusId = record["bonusId"] === undefined ? 0 : record["bonusId"];
  if (typeof bonusId !== "number") {
    throw new Error(`Artifact ${artifactId} use action ${key} bonusId is invalid`);
  }
  const description = record["description"] === undefined ? "" : record["description"];
  if (typeof description !== "string") {
    throw new Error(`Artifact ${artifactId} use action ${key} description is invalid`);
  }
  return new ArtifactUseAction(
    key,
    record["code"],
    record["param1"],
    record["param2"],
    record["dispose"],
    record["title"],
    bonusId,
    description,
  );
}
