import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { Fighter } from "./fighter.ts";
import type { PeriodicItem } from "./standing-effect.ts";
import { pocketHealAmount } from "./cast-state.ts";
import { magicReact, rollMagicHit } from "./magic-hit.ts";
import type { RandomSource } from "./random-source.ts";
import { resolveHpLoss } from "./resolve-hp-loss.ts";
import { shieldEvents } from "./shield-pool.ts";

/** Wire `hpChange.react` of a HoT tick (live trace: hp +N, react 32, no dmgType). */
const HOT_TICK_REACT = 32;

/** Turns what a clock step did to a fighter's DoT/HoT effects into fight events. */
export function applyPeriodicItems(
  fighter: Fighter,
  items: readonly PeriodicItem[],
  random: RandomSource,
  rules: BattleRules,
  sources: readonly Fighter[],
): readonly BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const item of items) {
    if (item.kind === "expire") {
      events.push({ type: "effect-purge", effectId: item.effectId });
      fighter.clampToMaxHp();
      fighter.clampToMaxMp();
      continue;
    }
    const { pulse } = item;
    if (pulse.kind === 5) {
      const healed = fighter.applyHeal(
        pulse.amount === undefined ? 0 : healTick(pulse.amount, fighter.maxHp),
      );
      requireTickSource(sources, pulse.sourceId).creditHealed(healed, fighter);
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
    const rolled = rollMagicHit({
      caster: { power: pulse.casterMagPower, resist: pulse.casterMagResist },
      target: fighter,
      casterStrength: pulse.casterStrength,
      dmgType: pulse.dmgType,
      ...(typeof pulse.amount === "number" ? { catalogAmount: pulse.amount } : {}),
      catalogStr: pulse.catalogStr,
      catalogPcStr: pulse.catalogPcStr,
      random,
      rules,
    });
    events.push(...shieldEvents(pulse.sourceId, fighter, fighter.effects.takeHitShield()));
    const { applied, killed } = resolveHpLoss(
      fighter,
      rolled,
      requireTickSource(sources, pulse.sourceId),
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

/** The caster of a tick is credited with its damage; a caster missing from the roster is a bug. */
function requireTickSource(sources: readonly Fighter[], sourceId: number): Fighter {
  const source = sources.find((fighter) => fighter.id === sourceId);
  if (!source) throw new Error(`Tick source ${sourceId} is not in the fight roster`);
  return source;
}
