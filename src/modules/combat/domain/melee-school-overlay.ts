import { appliedHpLoss } from "./applied-hp-loss.ts";
import type { ExtraHit } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { MagStats } from "./mag-stats.ts";
import { magicReact, rollMagicHit } from "./magic-hit.ts";
import type { RandomSource } from "./random-source.ts";
import { takeSchoolOverlay, type SchoolOverlay } from "./school-overlay.ts";

export type OverlayOwner = { schoolOverlay: SchoolOverlay | null };

export function rollOverlayExtra(
  owner: OverlayOwner,
  caster: MagStats,
  target: MagStats,
  targetHp: number,
  random: RandomSource,
  rules: BattleRules,
): ExtraHit | null {
  if (targetHp < 1) return null;
  const overlay = takeSchoolOverlay(owner);
  if (!overlay) return null;
  const raw = rollMagicHit({
    caster,
    target,
    casterStrength: overlay.casterStrength,
    dmgType: overlay.dmgType,
    ...(overlay.catalogAmount !== undefined ? { catalogAmount: overlay.catalogAmount } : {}),
    catalogStr: overlay.catalogStr,
    catalogPcStr: overlay.catalogPcStr,
    random,
    rules,
  });
  const applied = appliedHpLoss(raw, targetHp);
  if (applied < 1) return null;
  const killed = applied >= targetHp;
  return {
    hpChange: -applied,
    dmgType: overlay.dmgType,
    react: magicReact(killed),
    killed,
  };
}
