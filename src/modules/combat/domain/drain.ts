import type { BattleEvent } from "./battle-event.ts";
import type { Fighter } from "./fighter.ts";
import { resolveHpLoss } from "./resolve-hp-loss.ts";

/** Wire `hpChange.selfReact` of the swinger's own heal (live heal tick react). */
const HEAL_SELF_REACT = 32;
const HIT_REACT = 2;

/** Shares of the final damage of a swing: healed to the swinger, and taken from him. */
export type Drain = Readonly<{ healPct: number; hurtPct: number }>;

export const NO_DRAIN: Drain = { healPct: 0, hurtPct: 0 };

/**
 * `VAMP` heals, a negative `VAMP` and `ANTIVAMP` hurt the swinger. Heal and hurt never net
 * against each other (old server): both apply to the same hit.
 */
export function drainFromSkills(skill: (skillId: string) => number): Drain {
  const vamp = skill("VAMP");
  return {
    healPct: Math.max(vamp, 0),
    hurtPct: Math.max(-vamp, 0) + Math.max(skill("ANTIVAMP"), 0),
  };
}

export function addDrain(left: Drain, right: Drain): Drain {
  return { healPct: left.healPct + right.healPct, hurtPct: left.hurtPct + right.hurtPct };
}

export type DrainOutcome = Readonly<{
  /** Hp the swinger got back, for the hit's `hpChange.drain`. */
  healed: number;
  /** The self-damage as its own sibling `hpChange`; `null` when there is none. */
  hurtEvent: BattleEvent | null;
  selfReact: number;
}>;

/**
 * Settles the drain of a swing that dealt `dealt` final damage. The self-damage is taken as its own
 * hit and never kills the swinger (an assumption: the data says "up to 30% of the damage dealt").
 */
export function settleDrain(swinger: Fighter, dealt: number, drain: Drain): DrainOutcome {
  const none = { healed: 0, hurtEvent: null, selfReact: 0 };
  if (dealt < 1 || swinger.hp < 1) return none;
  const healed = swinger.applyHeal(Math.floor((dealt * drain.healPct) / 100));
  const hurt = Math.min(Math.floor((dealt * drain.hurtPct) / 100), swinger.hp - 1);
  const hurtApplied = hurt < 1 ? 0 : resolveHpLoss(swinger, hurt).applied;
  return {
    healed,
    hurtEvent:
      hurtApplied < 1
        ? null
        : {
            type: "damage",
            sourceId: swinger.id,
            targetId: swinger.id,
            animation: "",
            hpChange: -hurtApplied,
            targetMaxHp: swinger.maxHp,
            killed: false,
            react: HIT_REACT,
          },
    selfReact: healed > 0 ? HEAL_SELF_REACT : 0,
  };
}
