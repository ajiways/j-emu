import { ArtifactExtra } from "../domain/artifact-extra.ts";
import type { ArtifactSetInfo, SetBonusThreshold } from "../domain/artifact-set-info.ts";
import type {
  ArtifactGloveSocket,
  ArtifactSpell,
  ArtifactSpellEffect,
} from "../domain/artifact-spell.ts";

export function artifactExtraFromJson(artifactId: number, value: unknown): ArtifactExtra {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Artifact ${artifactId} extra must be an object`);
  }
  const record = value as Record<string, unknown>;
  return new ArtifactExtra(
    record.spell === undefined ? null : spellFromJson(artifactId, record.spell),
    socketsFromJson(artifactId, record.spells),
    hitsFromJson(artifactId, record.hits),
    setFromJson(artifactId, record.set),
    trendFromJson(artifactId, record.trend),
  );
}

function trendFromJson(artifactId: number, value: unknown): number {
  if (value === undefined) return 0;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 3) {
    throw new Error(`Artifact ${artifactId} extra.trend must be 0, 1, 2 or 3`);
  }
  return value;
}

function setFromJson(artifactId: number, value: unknown): ArtifactSetInfo | null {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Artifact ${artifactId} extra.set must be an object`);
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "number" || !Number.isInteger(record.id) || record.id < 1) {
    throw new Error(`Artifact ${artifactId} extra.set.id is required`);
  }
  if (typeof record.title !== "string" || !record.title) {
    throw new Error(`Artifact ${artifactId} extra.set.title is required`);
  }
  if (typeof record.avatar_man !== "string" || typeof record.avatar_woman !== "string") {
    throw new Error(`Artifact ${artifactId} extra.set avatars are required`);
  }
  const thresholds: SetBonusThreshold[] = [];
  for (let count = 1; count <= 9; count += 1) {
    const raw = record[`bonus${count}`];
    if (raw === undefined) continue;
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
      throw new Error(`Artifact ${artifactId} extra.set.bonus${count} is invalid`);
    }
    if (raw > 0) thresholds.push({ count, artikulId: raw });
  }
  return {
    setId: record.id,
    title: record.title,
    thresholds,
    avatarMan: record.avatar_man,
    avatarWoman: record.avatar_woman,
  };
}

function spellFromJson(artifactId: number, value: unknown): ArtifactSpell {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Artifact ${artifactId} extra.spell must be an object`);
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.effects) || record.effects.length < 1) {
    throw new Error(`Artifact ${artifactId} extra.spell effects are required`);
  }
  return {
    ...(typeof record.animData === "string" ? { animData: record.animData } : {}),
    ...(typeof record.groupId === "number" ? { groupId: record.groupId } : {}),
    ...(typeof record.cooldown === "number" ? { cooldown: record.cooldown } : {}),
    ...(typeof record.endTurn === "boolean" ? { endTurn: record.endTurn } : {}),
    ...(record.flags !== undefined ? { flags: String(record.flags) } : {}),
    ...(record.persRestr && typeof record.persRestr === "object"
      ? { persRestr: record.persRestr as Record<string, unknown> }
      : {}),
    ...(record.targetRestr && typeof record.targetRestr === "object"
      ? { targetRestr: record.targetRestr as Record<string, unknown> }
      : {}),
    effects: record.effects.map((effect, index) => effectFromJson(artifactId, effect, index)),
  };
}

function effectFromJson(artifactId: number, value: unknown, index: number): ArtifactSpellEffect {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Artifact ${artifactId} spell effect ${index} is invalid`);
  }
  const record = value as Record<string, unknown>;
  if (typeof record.kind !== "number" || !Number.isInteger(record.kind) || record.kind < 1) {
    throw new Error(`Artifact ${artifactId} spell effect ${index} kind is invalid`);
  }
  const effect: ArtifactSpellEffect = { kind: record.kind };
  if (record.amount !== undefined) {
    if (typeof record.amount !== "number" && typeof record.amount !== "string") {
      throw new Error(`Artifact ${artifactId} spell effect ${index} amount is invalid`);
    }
    return { ...effect, amount: record.amount, ...optionalEffectFields(record) };
  }
  return { ...effect, ...optionalEffectFields(record) };
}

function optionalEffectFields(record: Record<string, unknown>): Partial<ArtifactSpellEffect> {
  return {
    ...(typeof record.dmgType === "number" ? { dmgType: record.dmgType } : {}),
    ...(typeof record.charging === "number" ? { charging: record.charging } : {}),
    ...(typeof record.capacity === "number" ? { capacity: record.capacity } : {}),
    ...(typeof record.order === "number" ? { order: record.order } : {}),
    ...(typeof record.hidden === "number" ? { hidden: record.hidden } : {}),
    ...(typeof record.targetCount === "number" ? { targetCount: record.targetCount } : {}),
    ...(Array.isArray(record.skills)
      ? {
          skills: record.skills.map((skill) => {
            if (!skill || typeof skill !== "object" || Array.isArray(skill)) {
              throw new Error("Spell skill is invalid");
            }
            const row = skill as Record<string, unknown>;
            if (typeof row.skill_id !== "string" || typeof row.value !== "number") {
              throw new Error("Spell skill_id and value are required");
            }
            return { skillId: row.skill_id, value: row.value };
          }),
        }
      : {}),
  };
}

function socketsFromJson(artifactId: number, value: unknown): readonly ArtifactGloveSocket[] {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    throw new Error(`Artifact ${artifactId} extra.spells must be an array`);
  return value.map((socket, index) => {
    if (!socket || typeof socket !== "object" || Array.isArray(socket)) {
      throw new Error(`Artifact ${artifactId} glove socket ${index} is invalid`);
    }
    const row = socket as Record<string, unknown>;
    if (typeof row.cost !== "number" || typeof row.row !== "number") {
      throw new Error(`Artifact ${artifactId} glove socket ${index} cost/row are required`);
    }
    if (typeof row.artikul_id0 !== "number") {
      throw new Error(`Artifact ${artifactId} glove socket ${index} artikul_id0 is required`);
    }
    return { cost: row.cost, row: row.row, artikulId0: row.artikul_id0 };
  });
}

function hitsFromJson(artifactId: number, value: unknown): readonly number[] | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) throw new Error(`Artifact ${artifactId} extra.hits must be an array`);
  return value.map((hit, index) => {
    if (typeof hit !== "number" || !Number.isInteger(hit)) {
      throw new Error(`Artifact ${artifactId} extra.hits[${index}] is invalid`);
    }
    return hit;
  });
}
