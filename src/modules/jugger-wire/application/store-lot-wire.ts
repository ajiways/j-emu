import type { ArtifactSkillWireBlock } from "./artifact-skill-wire.ts";
import type { StoreLot } from "../../catalog/domain/store-lot.ts";

export type StoreLotArtifactView = Readonly<{
  id: number;
  title: string;
  picture: string;
  kindId: number;
  slotMask: number;
  levelMin: number;
  levelMax: number;
  flags: number;
  durability: number;
  durabilityMax: number;
  skills: Readonly<Record<string, ArtifactSkillWireBlock>>;
}>;

export type StoreLotWireBlock = Readonly<{
  id: number;
  title: string;
  type_id: number;
  kind_id: number;
  trend: 0;
  quality: 0;
  picture: string;
  price: number;
  level_min: number;
  level_max: number;
  durability: number;
  durability_max: number;
  validity: 0;
  cnt: 0 | 1;
  flags: number;
  slot_mask: number;
  slot2_mask: 0;
  companion_type: 0;
  lot_id: number;
  artifact_skills: Readonly<Record<string, ArtifactSkillWireBlock>>;
  time_start: "0";
  time_end: "0";
  action_type: "0";
  action_descr: "";
  action_time_start: "0";
  action_time_end: "0";
  favourite: 0;
  stack_cnt: "0";
  buy_cnt: "0";
  discount: "0";
  limit: "0";
  limit_clan: "0";
  limit_global: "0";
  limit_group_cd: "0";
}>;

const EMPTY_STORE_LOT_DISPLAY = {
  trend: 0,
  quality: 0,
  validity: 0,
  slot2_mask: 0,
  companion_type: 0,
  time_start: "0",
  time_end: "0",
  action_type: "0",
  action_descr: "",
  action_time_start: "0",
  action_time_end: "0",
  favourite: 0,
  stack_cnt: "0",
  buy_cnt: "0",
  discount: "0",
  limit: "0",
  limit_clan: "0",
  limit_global: "0",
  limit_group_cd: "0",
} as const;

export function storeLotWire(lot: StoreLot, artifact: StoreLotArtifactView): StoreLotWireBlock {
  if (!artifact.title) {
    throw new Error(`Store lot ${lot.lotId} artifact ${artifact.id} title is required`);
  }
  if (!artifact.picture) {
    throw new Error(`Store lot ${lot.lotId} artifact ${artifact.id} picture is required`);
  }
  if (!Number.isInteger(artifact.kindId) || artifact.kindId < 0) {
    throw new Error(`Store lot ${lot.lotId} artifact ${artifact.id} kindId is invalid`);
  }
  return {
    id: lot.artikulId,
    title: artifact.title,
    type_id: lot.typeId,
    kind_id: artifact.kindId,
    ...EMPTY_STORE_LOT_DISPLAY,
    picture: artifact.picture,
    price: lot.price,
    level_min: artifact.levelMin,
    level_max: artifact.levelMax,
    durability: artifact.durability,
    durability_max: artifact.durabilityMax,
    cnt: artifact.slotMask !== 0 ? 0 : 1,
    flags: artifact.flags,
    slot_mask: artifact.slotMask,
    lot_id: lot.lotId,
    artifact_skills: artifact.skills,
  };
}
