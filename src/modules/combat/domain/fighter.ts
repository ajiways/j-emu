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
  readonly level: number;
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
  /** Who dealt the blow that dropped this fighter to 0 hp; `null` while he stands. */
  readonly killedBy: number | null;
  markKilledBy(killerId: number): void;
  /** Books damage this fighter dealt to a target; a human target is booked by his id. */
  creditDealt(amount: number, target: Readonly<{ id: number; fighterKind: FighterKind }>): void;
  /** Books an execution this fighter carried out on `target`, who falls to it. */
  creditExecution(target: Fighter): void;
  /** The fighter fell to an execution. */
  markExecuted(): void;
  /** Books hit points this fighter restored to someone else; healing oneself is not booked. */
  creditHealed(amount: number, target: Readonly<{ id: number; fighterKind: FighterKind }>): void;
}
