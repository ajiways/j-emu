import { macroKeyId } from "../../../shared/kernel/macro-key-id.ts";

export type ArtifactMacroSource = Readonly<{
  id: number;
  title: string;
  picture: string;
  typeId: string;
  kindId: number;
  priceMinor: number;
  levelMin: number;
  levelMax: number;
  durability: number;
  durabilityMax: number;
  flags: number;
  slotMask: number;
  trend: number;
}>;

export type ArtifactMacroToken = Readonly<{
  key: string;
  token: string;
  macro: Readonly<Record<string, unknown>>;
}>;

export function buildArtifactMacro(source: ArtifactMacroSource): ArtifactMacroToken {
  if (!Number.isInteger(source.id) || source.id < 1) {
    throw new Error("Artifact macro id is invalid");
  }
  if (!source.title) throw new Error(`Artifact ${source.id} title is required`);
  if (!source.picture) throw new Error(`Artifact ${source.id} picture is required`);
  if (!source.typeId) throw new Error(`Artifact ${source.id} typeId is required`);
  if (!Number.isInteger(source.priceMinor) || source.priceMinor < 0) {
    throw new Error(`Artifact ${source.id} price is invalid`);
  }
  const key = macroKeyId("ARTIFACT", source.id);
  return {
    key,
    token: `[[ARTIFACT ${key}]]`,
    macro: {
      id: source.id,
      title: source.title,
      type_id: source.typeId,
      kind_id: source.kindId,
      trend: source.trend,
      quality: 0,
      picture: source.picture,
      price: source.priceMinor / 100,
      level_min: source.levelMin,
      level_max: source.levelMax,
      durability: source.durability,
      durability_max: source.durabilityMax,
      validity: 0,
      cnt: source.slotMask !== 0 ? 0 : 1,
      flags: source.flags,
      slot_mask: source.slotMask,
      slot2_mask: 0,
      companion_type: 0,
      artifact_skills: [],
      macro_text: source.title,
      creator_nick: "",
      engraved_note: "",
      key_id: key,
      macro_type: "ARTIFACT",
    },
  };
}
