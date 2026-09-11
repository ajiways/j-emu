type SpellSkill = Readonly<{ skillId: string; value: number }>;

/** Timed kind-3: fold pcSTR into flat STR, same shape as jgr-emu `bakeTimedStatPercents`. */
export function bakeTimedStatPercents(
  strength: number,
  skills: readonly SpellSkill[],
): Readonly<Record<string, number>> {
  if (!Number.isInteger(strength) || strength < 1) {
    throw new Error("Timed-buff strength must be positive");
  }
  const out: Record<string, number> = {};
  for (const skill of skills) {
    out[skill.skillId] = skill.value;
  }
  const pct = out.pcSTR;
  if (pct === undefined || pct === 0) return out;
  const flat = out.STR ?? 0;
  out.STR = Math.round((strength + flat) * (1 + pct / 100)) - strength;
  delete out.pcSTR;
  return out;
}
