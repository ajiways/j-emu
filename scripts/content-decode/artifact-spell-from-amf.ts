import { amfInteger, amfSpellSkillValue, amfString, isRecord } from "./amf-fields.ts";

const SPELL_KEYS = new Set([
  "animData",
  "groupId",
  "cooldown",
  "endTurn",
  "flags",
  "persRestr",
  "targetRestr",
  "triggers",
  "onlyPvP",
  "mpCost",
  "triggerCount",
  "needConfirm",
  "effects",
]);

const EFFECT_KEYS = new Set([
  "kind",
  "amount",
  "dmgType",
  "dmgMask",
  "charging",
  "capacity",
  "order",
  "hidden",
  "targetCount",
  "targetGroups",
  "targetEffectGroupId",
  "targetEffectCount",
  "botArtikulId",
  "duration",
  "period",
  "durationInTurns",
  "forceSelfTargeting",
  "realStartTime",
  "noHasten",
  "chargable",
  "dont_putoff_after_death",
  "animData",
  "manaCost",
  "limit",
  "useSkill",
  "delta",
  "skills",
  "skills2",
]);

const BOOLEAN_EFFECT_KEYS = [
  "durationInTurns",
  "forceSelfTargeting",
  "realStartTime",
  "noHasten",
  "chargable",
  "dont_putoff_after_death",
] as const;

const INTEGER_EFFECT_KEYS = [
  "dmgMask",
  "order",
  "hidden",
  "targetEffectGroupId",
  "targetEffectCount",
  "botArtikulId",
  "duration",
  "manaCost",
] as const;

/** Every spell field Pub1 ships is kept; an unknown field fails the decode instead of vanishing. */
export function decodeSpell(raw: unknown, artifactId: number): Record<string, unknown> | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const parsed = parseSpellPayload(raw, artifactId);
  if (!parsed) return undefined;
  const effectsRaw = parsed.effects;
  if (!Array.isArray(effectsRaw) || effectsRaw.length < 1) return undefined;
  requireKnownKeys(parsed, SPELL_KEYS, `artifact ${artifactId} spell`);
  const label = `artifact ${artifactId} spell`;
  return {
    ...(typeof parsed.animData === "string" && parsed.animData
      ? { animData: parsed.animData }
      : {}),
    ...positiveInt(parsed.groupId, `${label} groupId`, "groupId"),
    ...(parsed.cooldown !== undefined
      ? { cooldown: amfInteger(parsed.cooldown, `${label} cooldown`) }
      : {}),
    ...(parsed.mpCost !== undefined
      ? { mpCost: amfInteger(parsed.mpCost, `${label} mpCost`) }
      : {}),
    ...(parsed.triggerCount !== undefined
      ? { triggerCount: amfInteger(parsed.triggerCount, `${label} triggerCount`) }
      : {}),
    ...(typeof parsed.endTurn === "boolean" ? { endTurn: parsed.endTurn } : {}),
    ...(typeof parsed.needConfirm === "boolean" ? { needConfirm: parsed.needConfirm } : {}),
    ...(parsed.flags !== undefined ? { flags: parsed.flags } : {}),
    ...(isRecord(parsed.persRestr) ? { persRestr: parsed.persRestr } : {}),
    ...(isRecord(parsed.targetRestr) ? { targetRestr: parsed.targetRestr } : {}),
    ...(parsed.triggers !== undefined ? { triggers: parsed.triggers } : {}),
    ...(parsed.onlyPvP !== undefined ? { onlyPvP: parsed.onlyPvP } : {}),
    effects: effectsRaw.map((effect, index) => decodeEffect(effect, artifactId, index)),
  };
}

function decodeEffect(raw: unknown, artifactId: number, index: number): Record<string, unknown> {
  const label = `artifact ${artifactId} spell effect ${index}`;
  const row = requireRow(raw, label);
  requireKnownKeys(row, EFFECT_KEYS, label);
  const kind = amfInteger(row.kind, `${label} kind`);
  if (kind < 1) throw new Error(`${label} kind must be positive`);
  const effect: Record<string, unknown> = { kind };
  if (row.amount !== undefined) effect.amount = row.amount;
  if (row.dmgType !== undefined) effect.dmgType = amfInteger(row.dmgType, `${label} dmgType`);
  for (const key of ["charging", "capacity", "targetCount"] as const) {
    Object.assign(effect, positiveInt(row[key], `${label} ${key}`, key));
  }
  for (const key of INTEGER_EFFECT_KEYS) {
    if (row[key] !== undefined) effect[key] = amfInteger(row[key], `${label} ${key}`);
  }
  if (row.period !== undefined) {
    const period = amfInteger(row.period, `${label} period`);
    if (period < 1) throw new Error(`${label} period must be positive`);
    effect.period = period;
  }
  for (const key of BOOLEAN_EFFECT_KEYS) {
    if (row[key] !== undefined) effect[key] = requireBoolean(row[key], `${label} ${key}`);
  }
  if (row.animData !== undefined) effect.animData = amfString(row.animData, `${label} animData`);
  if (row.useSkill !== undefined) effect.useSkill = amfString(row.useSkill, `${label} useSkill`);
  if (row.limit !== undefined) effect.limit = decodeLimit(row.limit, `${label} limit`);
  if (row.targetGroups !== undefined) {
    effect.targetGroups = decodeIntegerList(row.targetGroups, `${label} targetGroups`);
  }
  if (row.delta !== undefined) effect.delta = decodeDelta(row.delta, `${label} delta`);
  if (row.skills !== undefined) effect.skills = decodeSkills(row.skills, label);
  if (row.skills2 !== undefined) effect.skills2 = decodeSkillPairs(row.skills2, `${label} skills2`);
  return effect;
}

function decodeSkills(raw: unknown, label: string): unknown {
  if (!Array.isArray(raw)) throw new Error(`${label} skills must be an array`);
  return raw.map((skill, skillIndex) => {
    const row = requireRow(skill, `${label} skill ${skillIndex}`);
    return {
      skill_id: amfString(row.skill_id, `${label} skill_id`),
      value: amfSpellSkillValue(row.value, `${label} skill ${skillIndex} value`),
    };
  });
}

function decodeSkillPairs(raw: unknown, label: string): unknown {
  if (!Array.isArray(raw)) throw new Error(`${label} must be an array`);
  return raw.map((pair, pairIndex) => {
    const row = requireRow(pair, `${label} ${pairIndex}`);
    requireKnownKeys(row, new Set(["skill1", "skill2", "abs", "proc"]), `${label} ${pairIndex}`);
    return {
      skill1: amfString(row.skill1, `${label} ${pairIndex} skill1`),
      skill2: amfString(row.skill2, `${label} ${pairIndex} skill2`),
      abs: amfSpellSkillValue(row.abs, `${label} ${pairIndex} abs`),
      proc: amfSpellSkillValue(row.proc, `${label} ${pairIndex} proc`),
    };
  });
}

function decodeDelta(raw: unknown, label: string): Record<string, unknown> {
  const row = requireRow(raw, label);
  requireKnownKeys(row, new Set(["skill", "abs", "proc", "target"]), label);
  return {
    skill: amfString(row.skill, `${label} skill`),
    ...(row.abs !== undefined ? { abs: amfSpellSkillValue(row.abs, `${label} abs`) } : {}),
    ...(row.proc !== undefined ? { proc: amfSpellSkillValue(row.proc, `${label} proc`) } : {}),
    ...(row.target !== undefined ? { target: requireBoolean(row.target, `${label} target`) } : {}),
  };
}

function decodeLimit(raw: unknown, label: string): number | string {
  if (typeof raw === "string") return raw;
  return amfInteger(raw, label);
}

function decodeIntegerList(raw: unknown, label: string): number[] {
  if (!Array.isArray(raw)) throw new Error(`${label} must be an array`);
  return raw.map((value, index) => amfInteger(value, `${label} ${index}`));
}

function parseSpellPayload(raw: unknown, artifactId: number): Record<string, unknown> | undefined {
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
      return parsed as Record<string, unknown>;
    } catch (error) {
      throw new Error(`artifact ${artifactId} spell JSON is invalid`, { cause: error });
    }
  }
  if (isRecord(raw)) return raw;
  throw new Error(`artifact ${artifactId} spell is invalid`);
}

function requireKnownKeys(row: Record<string, unknown>, known: ReadonlySet<string>, label: string) {
  for (const key of Object.keys(row)) {
    if (!known.has(key)) throw new Error(`${label} has unsupported field "${key}"`);
  }
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
  return value;
}

function positiveInt(value: unknown, label: string, key: string): Record<string, number> {
  if (value === undefined) return {};
  const parsed = amfInteger(value, label);
  return parsed < 1 ? {} : { [key]: parsed };
}

function requireRow(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}
