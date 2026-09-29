import type { HuntHumanFightEffects } from "./hunt-human-fight-effects.ts";
import type { MagStats } from "./mag-stats.ts";

export type FighterKind = "human" | "bot";

/**
 * What every fight participant, human- or bot-controlled, exposes to code that
 * changes hit points. Wire identity and effects stay on the concrete classes.
 */
export interface Fighter {
  readonly id: number;
  readonly fighterKind: FighterKind;
  readonly team: 1 | 2;
  readonly hp: number;
  readonly maxHp: number;
  readonly mag: MagStats;
  readonly effects: HuntHumanFightEffects;
  stunnedTurns: number;
  /** Returns true when this hit dropped the fighter to 0 hp. */
  applyDamage(amount: number): boolean;
  /** Returns the hp actually restored (capped at max hp). */
  applyHeal(amount: number): number;
  /** Books damage this fighter dealt to a target of the given kind. */
  creditDealt(amount: number, targetKind: FighterKind): void;
}
