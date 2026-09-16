import {
  amfGoldMinor,
  amfInteger,
  amfOmittedEmptyString,
  amfString,
  isRecord,
} from "./amf-fields.ts";
import {
  decodeArtifactActions,
  decodeArtifactExtra,
  decodeArtifactSkills,
  type DecodedSkillHint,
} from "./artifact-fields-from-amf.ts";
import { bagStackFor } from "./bag-stack-rules.ts";

export type DecodedArtifactDocument = Readonly<{
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
  durability: number;
  durabilityMax: number;
  skills: readonly Readonly<{ id: string; value: number; flags: number }>[];
  artifact_actions: Readonly<Record<string, unknown>>;
  extra: Readonly<Record<string, unknown>>;
  fBody: string;
}>;

export function artifactFromAmf(
  id: number,
  raw: unknown,
): { artifact: DecodedArtifactDocument; skillHints: readonly DecodedSkillHint[] } {
  if (!isRecord(raw)) throw new Error(`artifact ${id} AMF root must be an object`);
  const recordId = amfInteger(raw.id, `artifact ${id} id`);
  if (recordId !== id) {
    throw new Error(`artifact ${id} AMF id ${recordId} does not match filename`);
  }
  const typeId = amfString(raw.type_id, `artifact ${id} type_id`);
  if (!typeId) throw new Error(`artifact ${id} type_id is empty`);
  const weight = amfInteger(raw.weight, `artifact ${id} weight`);
  if (weight < 0) throw new Error(`artifact ${id} weight is negative`);
  const slotMask = amfInteger(raw.slot_mask, `artifact ${id} slot_mask`);
  const levelMin = amfInteger(raw.level_min, `artifact ${id} level_min`);
  const levelMax = publishedLevelMax(amfInteger(raw.level_max, `artifact ${id} level_max`), id);
  const durability = amfInteger(raw.durability, `artifact ${id} durability`);
  const durabilityMax = amfInteger(raw.durability_max, `artifact ${id} durability_max`);
  if (durability < 0 || durabilityMax < 0) {
    throw new Error(`artifact ${id} durability is invalid`);
  }
  const { skills, hints } = decodeArtifactSkills(raw.artifact_skills, id);
  return {
    artifact: {
      id,
      title: amfString(raw.title, `artifact ${id} title`),
      picture: amfString(raw.picture, `artifact ${id} picture`),
      typeId,
      kindId: amfInteger(raw.kind_id, `artifact ${id} kind_id`),
      slotMask,
      weight,
      levelMin,
      levelMax,
      gender: amfInteger(raw.gender, `artifact ${id} gender`),
      priceMinor: amfGoldMinor(raw.price, `artifact ${id} price`),
      flags: amfInteger(raw.flags, `artifact ${id} flags`),
      bagStack: bagStackFor(weight, slotMask),
      durability,
      durabilityMax,
      skills,
      artifact_actions: decodeArtifactActions(raw.artifact_actions, id),
      extra: decodeArtifactExtra(raw, id),
      fBody: amfOmittedEmptyString(raw.f_body, `artifact ${id} f_body`),
    },
    skillHints: hints,
  };
}

export function withWeight(
  artifact: DecodedArtifactDocument,
  weight: number,
): DecodedArtifactDocument {
  if (!Number.isInteger(weight) || weight < 0) {
    throw new Error(`artifact ${artifact.id} overlay weight is invalid`);
  }
  return {
    ...artifact,
    weight,
    bagStack: bagStackFor(weight, artifact.slotMask),
  };
}

/** INVENTORY.md: Pub1 `level_max=-1` publishes as 0; positive caps stay. */
function publishedLevelMax(levelMax: number, artifactId: number): number {
  if (levelMax === -1) return 0;
  if (levelMax < 0) throw new Error(`artifact ${artifactId} level_max is invalid`);
  return levelMax;
}
