import { ArtifactDefinition } from "../../src/modules/catalog/domain/artifact-definition.ts";
import { ArtifactExtra } from "../../src/modules/catalog/domain/artifact-extra.ts";
import { ArtifactSkillBonus } from "../../src/modules/catalog/domain/artifact-skill-bonus.ts";
import type { ArtifactUseAction } from "../../src/modules/catalog/domain/artifact-use-action.ts";

export function testArtifact(
  overrides: {
    id?: number;
    title?: string;
    picture?: string;
    typeId?: string;
    kindId?: number;
    slotMask?: number;
    weight?: number;
    levelMin?: number;
    levelMax?: number;
    gender?: number;
    priceMinor?: number;
    flags?: number;
    bagStack?: number;
    durability?: number;
    durabilityMax?: number;
    skills?: readonly ArtifactSkillBonus[];
    useActions?: Readonly<Record<string, ArtifactUseAction>>;
    extra?: ArtifactExtra;
  } = {},
): ArtifactDefinition {
  const id = overrides.id ?? 9095;
  const durability = overrides.durability ?? (id === 9095 ? 3 : 0);
  const durabilityMax = overrides.durabilityMax ?? (id === 9095 ? 3 : 0);
  return new ArtifactDefinition(
    id,
    overrides.title ?? "Ветхая магическая перчатка",
    overrides.picture ?? "greyset5_lhand.png",
    overrides.typeId ?? "2",
    overrides.kindId ?? 44,
    overrides.slotMask ?? 32,
    overrides.weight ?? 0,
    overrides.levelMin ?? 1,
    overrides.levelMax ?? 0,
    overrides.gender ?? 0,
    overrides.priceMinor ?? 0,
    overrides.flags ?? 40,
    overrides.bagStack ?? 1,
    overrides.skills ?? [new ArtifactSkillBonus("VIT", 5, 0)],
    overrides.useActions ?? {},
    overrides.extra ?? new ArtifactExtra(null, [], null),
    durability,
    durabilityMax,
  );
}
