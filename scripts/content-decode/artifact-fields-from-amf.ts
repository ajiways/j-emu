import {
  amfActionParam,
  amfInteger,
  amfOmittedZeroInteger,
  amfString,
  isRecord,
} from "./amf-fields.ts";
import { decodeRankRule } from "./artifact-rank-rule-from-amf.ts";
import { decodeSpell } from "./artifact-spell-from-amf.ts";
import {
  GEAR_COMBO_GLOVE_ARTIKUL_ID,
  GLOVE_CATALOG_HITS,
  GLOVE_CATALOG_HITS_ARTIKUL_ID,
} from "./glove-hits-policy.ts";

export type DecodedArtifactSkill = Readonly<{ id: string; value: number; flags: number }>;
export type DecodedArtifactAction = Readonly<{
  code: string;
  param1: number | string;
  param2: number | string;
  dispose: 0 | 1;
  title: string;
  bonusId: number;
  description: string;
}>;
export type DecodedArtifactExtra = Readonly<Record<string, unknown>>;
export type DecodedSkillHint = Readonly<{
  id: string;
  title: string;
  group: string;
  order: string;
  weight: string;
  image: string;
}>;

export function decodeArtifactSkills(
  raw: unknown,
  artifactId: number,
): {
  skills: DecodedArtifactSkill[];
  hints: DecodedSkillHint[];
} {
  const entries = skillEntries(raw, artifactId);
  const skills: DecodedArtifactSkill[] = [];
  const hints: DecodedSkillHint[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const id = amfString(entry.skill_id, `artifact ${artifactId} skill_id`);
    if (!id) throw new Error(`artifact ${artifactId} skill_id is empty`);
    if (seen.has(id)) throw new Error(`artifact ${artifactId} duplicate skill ${id}`);
    seen.add(id);
    skills.push({
      id,
      value: amfInteger(entry.value, `artifact ${artifactId} skill ${id} value`),
      flags: amfOmittedZeroInteger(
        entry.skill_flags,
        `artifact ${artifactId} skill ${id} skill_flags`,
      ),
    });
    const title =
      entry.title === undefined || entry.title === null
        ? ""
        : amfString(entry.title, `artifact ${artifactId} skill ${id} title`);
    hints.push({
      id,
      title,
      group: String(
        amfOmittedZeroInteger(entry.group_id, `artifact ${artifactId} skill ${id} group_id`),
      ),
      order: String(amfOmittedZeroInteger(entry.order, `artifact ${artifactId} skill ${id} order`)),
      weight: String(
        amfOmittedZeroInteger(entry.weight, `artifact ${artifactId} skill ${id} weight`),
      ),
      image: optionalPicture(entry.picture_small),
    });
  }
  skills.sort((left, right) => left.id.localeCompare(right.id));
  return { skills, hints };
}

export function decodeArtifactActions(
  raw: unknown,
  artifactId: number,
): Record<string, DecodedArtifactAction> {
  if (raw === undefined || raw === null) {
    return {};
  }
  const rows = actionRows(raw, artifactId);
  const actions: Record<string, DecodedArtifactAction> = {};
  for (const row of rows) {
    const key = String(amfInteger(row.id, `artifact ${artifactId} action id`));
    if (key === "0") throw new Error(`artifact ${artifactId} action id is 0`);
    if (key in actions) throw new Error(`artifact ${artifactId} duplicate action ${key}`);
    const dispose = amfOmittedZeroInteger(
      row.dispose,
      `artifact ${artifactId} action ${key} dispose`,
    );
    if (dispose !== 0 && dispose !== 1) {
      throw new Error(`artifact ${artifactId} action ${key} dispose is invalid`);
    }
    const title =
      row.title === undefined || row.title === null
        ? ""
        : amfString(row.title, `artifact ${artifactId} action ${key} title`);
    actions[key] = {
      code:
        row.code === undefined || row.code === null
          ? ""
          : amfString(row.code, `artifact ${artifactId} action ${key} code`),
      param1: amfActionParam(row.param1, `artifact ${artifactId} action ${key} param1`),
      param2: amfActionParam(row.param2, `artifact ${artifactId} action ${key} param2`),
      dispose,
      title,
      bonusId: amfOmittedZeroInteger(row.bonus_id, `artifact ${artifactId} action ${key} bonus_id`),
      description:
        row.description === undefined || row.description === null
          ? ""
          : amfString(row.description, `artifact ${artifactId} action ${key} description`),
    };
  }
  return actions;
}

export function decodeArtifactExtra(
  record: Record<string, unknown>,
  artifactId: number,
): DecodedArtifactExtra {
  const extra: Record<string, unknown> = {};
  const spell = decodeSpell(record.spell, artifactId);
  if (spell) extra.spell = spell;
  const sockets = decodeSockets(record.spells, artifactId);
  if (artifactId === GLOVE_CATALOG_HITS_ARTIKUL_ID) {
    if (sockets.length < 1) {
      throw new Error(`artifact ${artifactId} glove sockets are required`);
    }
    extra.spells = sockets;
    extra.hits = [...GLOVE_CATALOG_HITS];
  } else if (sockets.length > 0 && artifactId !== GEAR_COMBO_GLOVE_ARTIKUL_ID) {
    extra.spells = sockets;
  }
  const set = decodeSet(record.set, artifactId);
  if (set) extra.set = set;
  const trend = amfOmittedZeroInteger(record.trend, `artifact ${artifactId} trend`);
  if (trend < 0 || trend > 3) throw new Error(`artifact ${artifactId} trend is invalid`);
  extra.trend = trend;
  const param1 = amfOmittedZeroInteger(record.param1, `artifact ${artifactId} param1`);
  if (param1 !== 0) extra.param1 = param1;
  const flagsExt = amfOmittedZeroInteger(record.flags_ext, `artifact ${artifactId} flags_ext`);
  if (flagsExt !== 0) extra.flagsExt = flagsExt;
  const slot2Mask = amfOmittedZeroInteger(record.slot2_mask, `artifact ${artifactId} slot2_mask`);
  if (slot2Mask !== 0) extra.slot2Mask = slot2Mask;
  const rank = decodeRankRule(record.description, artifactId);
  if (rank) extra.rank = rank;
  return extra;
}

function skillEntries(raw: unknown, artifactId: number): Record<string, unknown>[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.map((row, index) => requireRow(row, `artifact ${artifactId} skill ${index}`));
  }
  if (!isRecord(raw)) throw new Error(`artifact ${artifactId} artifact_skills is invalid`);
  return Object.values(raw).map((row, index) =>
    requireRow(row, `artifact ${artifactId} skill ${index}`),
  );
}

function actionRows(raw: unknown, artifactId: number): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.map((row, index) => requireRow(row, `artifact ${artifactId} action ${index}`));
  }
  if (!isRecord(raw)) throw new Error(`artifact ${artifactId} artifact_actions is invalid`);
  return Object.values(raw).map((row, index) =>
    requireRow(row, `artifact ${artifactId} action ${index}`),
  );
}

function decodeSockets(raw: unknown, artifactId: number): Array<Record<string, unknown>> {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error(`artifact ${artifactId} extra.spells must be an array`);
  const sockets: Array<Record<string, unknown>> = [];
  for (const [index, value] of raw.entries()) {
    const row = requireRow(value, `artifact ${artifactId} socket ${index}`);
    const artikulId0 = amfOmittedZeroInteger(
      row.artikul_id0,
      `artifact ${artifactId} socket ${index} artikul_id0`,
    );
    const pool: Record<string, number> = {};
    for (let slot = 1; slot <= 6; slot += 1) {
      const poolId = amfOmittedZeroInteger(
        row[`artikul_id${slot}`],
        `artifact ${artifactId} socket ${index} artikul_id${slot}`,
      );
      if (poolId >= 1) pool[`artikul_id${slot}`] = poolId;
    }
    if (artikulId0 < 1 && Object.keys(pool).length < 1) continue;
    const socket: Record<string, unknown> = {
      cost: requirePositive(
        amfInteger(row.cost, `artifact ${artifactId} socket ${index} cost`),
        `artifact ${artifactId} socket ${index} cost`,
      ),
      row: requirePositive(
        amfInteger(row.row, `artifact ${artifactId} socket ${index} row`),
        `artifact ${artifactId} socket ${index} row`,
      ),
      artikul_id0: artikulId0,
      ...pool,
    };
    if (row.id !== undefined) {
      const id = amfInteger(row.id, `artifact ${artifactId} socket ${index} id`);
      if (id > 0) socket.id = id;
    }
    sockets.push(socket);
  }
  return sockets;
}

function decodeSet(raw: unknown, artifactId: number): Record<string, unknown> | undefined {
  if (raw === undefined || raw === null || (Array.isArray(raw) && raw.length === 0)) {
    return undefined;
  }
  if (!isRecord(raw)) throw new Error(`artifact ${artifactId} extra.set is invalid`);
  const id = amfInteger(raw.id, `artifact ${artifactId} set.id`);
  if (id < 1) throw new Error(`artifact ${artifactId} set.id is invalid`);
  const set: Record<string, unknown> = {
    id,
    title: amfString(raw.title, `artifact ${artifactId} set.title`),
    avatar_man: amfString(raw.avatar_man, `artifact ${artifactId} set.avatar_man`),
    avatar_woman: amfString(raw.avatar_woman, `artifact ${artifactId} set.avatar_woman`),
  };
  for (let count = 1; count <= 9; count += 1) {
    const key = `bonus${count}`;
    if (raw[key] === undefined) continue;
    const bonus = amfInteger(raw[key], `artifact ${artifactId} set.${key}`);
    if (bonus < 0) throw new Error(`artifact ${artifactId} set.${key} is invalid`);
    if (bonus > 0) set[key] = bonus;
  }
  return set;
}

function requirePositive(value: number, label: string): number {
  if (value < 1) throw new Error(`${label} must be positive`);
  return value;
}

function requireRow(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function optionalPicture(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error("skill picture_small must be a string");
  return value;
}
