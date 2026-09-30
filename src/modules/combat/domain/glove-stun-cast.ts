import type { BattleEvent } from "./battle-event.ts";
import type { CombatGloveSpell } from "./combat-loadout.ts";
import type { Fighter } from "./fighter.ts";
import { FightCastDenied } from "./fight-cast-denied.ts";
import type { HumanFighter } from "./human-fighter.ts";
import { applyStun } from "./apply-stun.ts";

/**
 * A glove spell that only stuns (kind 18, no strike, does not end the turn): the foe loses the
 * next turns of the spell, the caster keeps his turn. The spell's kind-3 debuff on the foe is not
 * modelled yet.
 */
export function castGloveStun(
  human: HumanFighter,
  glove: CombatGloveSpell,
  foe: Fighter,
  nowMs: number,
  sequence: string | number,
): readonly BattleEvent[] {
  if (human.casts.gloveCooldownLeftMs(glove, nowMs) > 0) {
    throw new FightCastDenied("cooldown", sequence);
  }
  const cp = human.casts.spendCombo(glove.cost);
  human.casts.noteGloveUse(glove, nowMs);
  const icon = applyStun(human, foe, glove);
  return [
    icon,
    {
      type: "buff-cast",
      animation: glove.spell.animData ?? "",
      sourceId: human.id,
      targetId: foe.id,
      maxHp: foe.maxHp,
    },
    { type: "pers-cp", cp },
  ];
}
