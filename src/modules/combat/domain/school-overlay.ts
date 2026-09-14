import type { CombatSpell } from "./combat-loadout.ts";
import { kind1Effect, kind1OverlayCharges, spellSkillValue } from "./magic-hit.ts";

export type SchoolOverlay = Readonly<{
  dmgType: number;
  charges: number;
  catalogStr: number;
  catalogPcStr: number;
  catalogAmount?: number;
  casterStrength: number;
}>;

export function schoolOverlayFromKind1(
  spell: CombatSpell,
  casterStrength: number,
): SchoolOverlay | null {
  const charges = kind1OverlayCharges(spell);
  if (charges < 1) return null;
  const kind1 = kind1Effect(spell);
  if (!kind1) throw new Error("Kind-1 overlay is missing its kind-1 effect");
  return {
    dmgType: kind1.dmgType ?? 64,
    charges,
    catalogStr: spellSkillValue(kind1, "STR"),
    catalogPcStr: spellSkillValue(kind1, "pcSTR"),
    ...(typeof kind1.amount === "number" ? { catalogAmount: kind1.amount } : {}),
    casterStrength,
  };
}

export function takeSchoolOverlay(owner: {
  schoolOverlay: SchoolOverlay | null;
}): SchoolOverlay | null {
  const overlay = owner.schoolOverlay;
  if (!overlay) return null;
  const next = overlay.charges - 1;
  owner.schoolOverlay = next < 1 ? null : { ...overlay, charges: next };
  return overlay;
}
