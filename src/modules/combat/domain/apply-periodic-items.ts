import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { Fighter } from "./fighter.ts";
import type { PeriodicItem } from "./fighter-effects.ts";
import { pocketHealAmount } from "./human-cast-state.ts";
import { magicReact, rollMagicHit } from "./magic-hit.ts";
import type { RandomSource } from "./random-source.ts";
import { resolveHpLoss } from "./resolve-hp-loss.ts";

/** Wire `hpChange.react` of a HoT tick (live trace: hp +N, react 32, no dmgType). */
const HOT_TICK_REACT = 32;

/** Turns what a clock step did to a fighter's DoT/HoT effects into fight events. */
export function applyPeriodicItems(
  fighter: Fighter,
  items: readonly PeriodicItem[],
  random: RandomSource,
  rules: BattleRules,
): readonly BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const item of items) {
    if (item.kind === "expire") {
      events.push({ type: "effect-purge", effectId: item.effectId });
      continue;
    }
    const { pulse } = item;
    if (pulse.kind === 5) {
      const healed = fighter.applyHeal(
        pulse.amount === undefined ? 0 : healTick(pulse.amount, fighter.maxHp),
      );
      events.push({
        type: "damage",
        sourceId: pulse.sourceId,
        targetId: fighter.id,
        animation: "",
        hpChange: healed,
        targetMaxHp: fighter.maxHp,
        killed: false,
        react: HOT_TICK_REACT,
        dmgType: pulse.dmgType,
      });
      continue;
    }
    if (fighter.hp < 1) continue;
    const { applied, killed } = resolveHpLoss(
      fighter,
      rollMagicHit({
        caster: { power: pulse.casterMagPower, resist: pulse.casterMagResist },
        target: fighter.mag,
        casterStrength: pulse.casterStrength,
        dmgType: pulse.dmgType,
        ...(typeof pulse.amount === "number" ? { catalogAmount: pulse.amount } : {}),
        catalogStr: pulse.catalogStr,
        catalogPcStr: pulse.catalogPcStr,
        random,
        rules,
      }),
    );
    if (applied < 1) continue;
    events.push({
      type: "damage",
      sourceId: pulse.sourceId,
      targetId: fighter.id,
      animation: "",
      hpChange: -applied,
      targetMaxHp: fighter.maxHp,
      killed,
      react: magicReact(killed),
      dmgType: pulse.dmgType,
    });
  }
  return events;
}

function healTick(amount: number | string, maxHp: number): number {
  if (typeof amount === "number") return amount;
  return pocketHealAmount({ effects: [{ kind: 2, amount }] }, maxHp);
}
