import type { FighterEffects } from "./fighter-effects.ts";
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
  readonly effects: FighterEffects;
  stunnedTurns: number;
  /** Returns true when this hit dropped the fighter to 0 hp. */
  applyDamage(amount: number): boolean;
  /** Returns the hp actually restored (capped at max hp). */
  applyHeal(amount: number): number;
  /** Pulls hp down to the max hp after a buff that raised it ran out. */
  clampToMaxHp(): void;
  /** Pulls mana down to the max after a buff that raised it ran out. */
  clampToMaxMp(): void;
  /** Rage a received hit of `damage` adds to this fighter; returns the rage gained. */
  awardIncomingRage(damage: number): number;
  /** Books damage this fighter dealt to a target of the given kind. */
  creditDealt(amount: number, targetKind: FighterKind): void;
}
