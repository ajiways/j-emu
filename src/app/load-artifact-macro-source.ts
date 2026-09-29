import type { ArtifactMacroSource } from "../modules/chat/domain/artifact-macro.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import { artifactSkillWireMap } from "../modules/jugger-wire/application/artifact-skill-wire.ts";

export async function loadArtifactMacroSource(
  catalog: Catalog,
  artikulId: number,
): Promise<ArtifactMacroSource> {
  const definition = await catalog.artifact(artikulId);
  if (!definition) throw new Error(`Artifact catalog entry ${artikulId} is missing`);
  return {
    id: definition.id,
    title: definition.title,
    picture: definition.picture,
    typeId: definition.typeId,
    kindId: definition.kindId,
    priceMinor: definition.priceMinor,
    levelMin: definition.levelMin,
    levelMax: definition.levelMax,
    durability: definition.durability,
    durabilityMax: definition.durabilityMax,
    flags: definition.flags,
    slotMask: definition.slotMask,
    trend: definition.extra.trend,
    skillBlocks: await artifactSkillWireMap(definition.skills, catalog),
  };
}
