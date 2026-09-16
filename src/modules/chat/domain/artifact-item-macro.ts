import { macroKeyId } from "../../../shared/kernel/macro-key-id.ts";
import type { ArtifactSkillBonus } from "../../catalog/domain/artifact-skill-bonus.ts";

export type ArtifactItemMacroSource = Readonly<{
  itemId: number;
  artifactId: number;
  title: string;
  picture: string;
  typeId: string;
  kindId: number;
  flags: number;
  flagsExt: number;
  priceMinor: number;
  levelMin: number;
  levelMax: number;
  durability: number;
  durabilityMax: number;
  slot: number;
  slotMask: number;
  skills: readonly ArtifactSkillBonus[];
}>;

export type ArtifactItemMacroToken = Readonly<{
  key: string;
  token: string;
  macro: Readonly<Record<string, unknown>>;
}>;

export function buildArtifactItemMacro(source: ArtifactItemMacroSource): ArtifactItemMacroToken {
  if (!Number.isInteger(source.itemId) || source.itemId < 1) {
    throw new Error("Artifact item macro itemId is invalid");
  }
  if (!Number.isInteger(source.artifactId) || source.artifactId < 1) {
    throw new Error(`Artifact item ${source.itemId} artifactId is invalid`);
  }
  if (!source.title) throw new Error(`Artifact item ${source.itemId} title is required`);
  if (!source.picture) throw new Error(`Artifact item ${source.itemId} picture is required`);
  if (!source.typeId) throw new Error(`Artifact item ${source.itemId} typeId is required`);
  if (!Number.isInteger(source.priceMinor) || source.priceMinor < 0) {
    throw new Error(`Artifact item ${source.itemId} price is invalid`);
  }
  if (!Number.isInteger(source.durability) || source.durability < 0) {
    throw new Error(`Artifact item ${source.itemId} durability is invalid`);
  }
  if (!Number.isInteger(source.durabilityMax) || source.durabilityMax < 0) {
    throw new Error(`Artifact item ${source.itemId} durabilityMax is invalid`);
  }
  if (!Number.isInteger(source.slot) || source.slot < 0) {
    throw new Error(`Artifact item ${source.itemId} slot is invalid`);
  }
  const key = macroKeyId("ARTIFACT_ITEM", source.itemId);
  return {
    key,
    token: `[[ARTIFACT_ITEM ${key}]]`,
    macro: {
      id: source.itemId,
      artikul_id: source.artifactId,
      title: source.title,
      picture: source.picture,
      type_id: source.typeId,
      kind_id: source.kindId,
      flags: source.flags,
      flags_ext: source.flagsExt,
      price: source.priceMinor / 100,
      quality: 0,
      level_min: source.levelMin,
      level_max: source.levelMax,
      durability: source.durability,
      durability_max: source.durabilityMax,
      slot: source.slot,
      slot_mask: source.slotMask,
      slot2_mask: 0,
      cnt: 0,
      artifact_skills: source.skills.map((skill) => ({
        id: skill.id,
        value: skill.value,
        flags: skill.flags,
      })),
      key_id: key,
      macro_type: "ARTIFACT_ITEM",
    },
  };
}
