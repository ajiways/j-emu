import { appliedHpLoss } from "./applied-hp-loss.ts";
import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { magicReact, rollMagicHit } from "./magic-hit.ts";
import type { RandomSource } from "./random-source.ts";
import { pocketHealAmount } from "./hunt-human-cast-state.ts";

export function applyCarrierTicks(
  human: HuntHuman,
  random: RandomSource,
  rules: BattleRules,
): readonly BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const pulse of human.effects.takeTickPulses()) {
    if (pulse.kind === 5) {
      const healed = human.applyHeal(
        typeof pulse.amount === "string" || typeof pulse.amount === "number"
          ? healTick(pulse.amount, human.maxHp)
          : 0,
      );
      events.push({
        type: "damage",
        sourceId: pulse.sourceId,
        targetId: human.heroId,
        animation: "",
        hpChange: healed,
        targetMaxHp: human.maxHp,
        killed: false,
        react: 0,
        dmgType: pulse.dmgType,
      });
      if (pulse.last) events.push({ type: "effect-purge", effectId: pulse.effectId });
      continue;
    }
    if (human.hp < 1) {
      if (pulse.last) events.push({ type: "effect-purge", effectId: pulse.effectId });
      continue;
    }
    const damage = appliedHpLoss(
      rollMagicHit({
        caster: { power: pulse.casterMagPower, resist: pulse.casterMagResist },
        target: human.mag,
        casterStrength: pulse.casterStrength,
        dmgType: pulse.dmgType,
        ...(typeof pulse.amount === "number" ? { catalogAmount: pulse.amount } : {}),
        catalogStr: pulse.catalogStr,
        catalogPcStr: pulse.catalogPcStr,
        random,
        rules,
      }),
      human.hp,
    );
    if (damage < 1) {
      if (pulse.last) events.push({ type: "effect-purge", effectId: pulse.effectId });
      continue;
    }
    const killed = human.applyDamage(damage);
    events.push({
      type: "damage",
      sourceId: pulse.sourceId,
      targetId: human.heroId,
      animation: "",
      hpChange: -damage,
      targetMaxHp: human.maxHp,
      killed,
      react: magicReact(killed),
      dmgType: pulse.dmgType,
    });
    if (pulse.last) events.push({ type: "effect-purge", effectId: pulse.effectId });
  }
  return events;
}

function healTick(amount: number | string, maxHp: number): number {
  if (typeof amount === "number") return amount;
  return pocketHealAmount({ effects: [{ kind: 2, amount }] }, maxHp);
}
