import { appliedHpLoss } from "./applied-hp-loss.ts";
import type { BattleEvent, ExtraHit } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { DamageTarget } from "./damage-target.ts";
import type { FighterEffects } from "./fighter-effects.ts";
import type { MagStats } from "./mag-stats.ts";
import { magicReact, rollMagicHit } from "./magic-hit.ts";
import type { RandomSource } from "./random-source.ts";

export type OverlayRoll = Readonly<{
  extra: ExtraHit | null;
  /** `effPurge` for the charged effect this float was the last charge of. */
  purges: readonly BattleEvent[];
}>;

/**
 * The school float a charged overlay adds to a landed swing. A target already down keeps the
 * charge for the next one; otherwise the charge is spent even when the float deals nothing.
 */
export function rollOverlayExtra(
  effects: FighterEffects,
  caster: MagStats,
  target: DamageTarget,
  targetHp: number,
  random: RandomSource,
  rules: BattleRules,
): OverlayRoll {
  if (targetHp < 1) return { extra: null, purges: [] };
  const taken = effects.takeOverlay();
  if (!taken) return { extra: null, purges: [] };
  const { overlay } = taken;
  const purges = taken.purged.map((effectId) => ({ type: "effect-purge" as const, effectId }));
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
  if (applied < 1) return { extra: null, purges };
  const killed = applied >= targetHp;
  return {
    extra: { hpChange: -applied, dmgType: overlay.dmgType, react: magicReact(killed), killed },
    purges,
  };
}
