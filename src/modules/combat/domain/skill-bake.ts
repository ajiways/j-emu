export type SkillValue = Readonly<{ skillId: string; value: number }>;

/** The fighter's own stats at the moment a timed buff is cast; the bake is frozen against them. */
export type StatBase = Readonly<{
  STR: number;
  DEX: number;
  DEF: number;
  RAG: number;
  BLOK: number;
  HPMAX: number;
}>;

const STATS = ["STR", "DEX", "DEF", "RAG", "BLOK", "HPMAX"] as const;
/** Live 182 (`DEX 32, pcDEX 1.23`) and 169 (`HPMAX 39, pcHPMAX 1.35`) keep the multiplier on the wire. */
const KEEPS_MULTIPLIER: ReadonlySet<string> = new Set(["DEX", "DEF", "BLOK", "HPMAX"]);

/**
 * Folds a timed buff's percent skills into flat ones the way the live server sends them:
 * `flat = round((base + flat) × (1 + pc / 100)) − base` (live 182: base 36, 19 and 23% -> 32).
 * DEX, DEF, BLOK and HPMAX also keep `pcX` as the multiplier (1.23); STR and RAG drop it, as the
 * old server did. Every other skill passes through untouched.
 */
export function bakeSkills(
  skills: readonly SkillValue[],
  base: StatBase,
): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const skill of skills) out[skill.skillId] = skill.value;
  for (const stat of STATS) {
    const percent = out[`pc${stat}`];
    if (percent === undefined || percent === 0) continue;
    const flat = out[stat] ?? 0;
    out[stat] = Math.round((base[stat] + flat) * (1 + percent / 100)) - base[stat];
    if (KEEPS_MULTIPLIER.has(stat)) out[`pc${stat}`] = Math.round((1 + percent / 100) * 100) / 100;
    else delete out[`pc${stat}`];
  }
  return out;
}
