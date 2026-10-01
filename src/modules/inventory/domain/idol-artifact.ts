import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";

const IDOL_KIND_ID = 35;
const SUMMON_EFFECT_KIND = 10;

/**
 * An idol: a kind-35 artifact whose spell summons a mob. The client lists exactly these bag items
 * in the fight's right pocket (`show_extern`); of the live kind-35 items only the idol had it.
 */
export function isIdolArtifact(definition: ArtifactDefinition): boolean {
  const spell = definition.extra.spell;
  return (
    definition.kindId === IDOL_KIND_ID &&
    spell != null &&
    spell.effects.some((effect) => effect.kind === SUMMON_EFFECT_KIND)
  );
}
