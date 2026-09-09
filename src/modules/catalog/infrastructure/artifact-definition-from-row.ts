import { ArtifactDefinition } from "../domain/artifact-definition.ts";
import { artifactExtraFromJson } from "./artifact-extra-from-json.ts";
import { artifactSkillsFromJson } from "./artifact-skills-from-json.ts";
import { artifactUseActionsFromJson } from "./artifact-use-actions-from-json.ts";

export function artifactDefinitionFromRow(row: {
  id: number;
  title: string;
  picture: string;
  typeId: string;
  kindId: number;
  slotMask: number;
  weight: number;
  levelMin: number;
  levelMax: number;
  gender: number;
  priceMinor: number;
  flags: number;
  bagStack: number;
  skills: unknown;
  artifactActions: unknown;
  extra: unknown;
}): ArtifactDefinition {
  return new ArtifactDefinition(
    row.id,
    row.title,
    row.picture,
    row.typeId,
    row.kindId,
    row.slotMask,
    row.weight,
    row.levelMin,
    row.levelMax,
    row.gender,
    row.priceMinor,
    row.flags,
    row.bagStack,
    artifactSkillsFromJson(row.id, row.skills),
    artifactUseActionsFromJson(row.id, row.artifactActions),
    artifactExtraFromJson(row.id, row.extra),
  );
}
