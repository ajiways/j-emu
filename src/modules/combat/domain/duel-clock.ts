import type { Roster } from "./roster.ts";
import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { applyPeriodicItems } from "./apply-periodic-items.ts";
import type { Fighter } from "./fighter.ts";
import type { HumanFighter } from "./human-fighter.ts";
import { enemySideCleared } from "./melee-target.ts";
import { opposingTeam } from "./opposing-team.ts";
import type { RandomSource } from "./random-source.ts";

/**
 * A turn-ending action fills its whole turn slot on the fight clock: the seconds not yet
 * spent in real time are added as a jump (the live `timeAdvance.span`).
 */
function slotJumpSeconds(rules: BattleRules, elapsedMs: number): number {
  return Math.max(0, rules.turnTimeoutSeconds - elapsedMs / 1000);
}

/** The bot's counter lands `meleeBotCounterMs` after the hit it answers. */
export function botActionJumpSeconds(rules: BattleRules): number {
  return slotJumpSeconds(rules, rules.meleeBotCounterMs);
}

/** Advances the DoT/HoT effects of the fighters in one duel after a turn-ending action. */
export function advanceDuelClock(
  input: Readonly<{
    fighters: readonly Fighter[];
    nowMs: number;
    jumpSeconds: number;
    random: RandomSource;
    rules: BattleRules;
    sources: readonly Fighter[];
  }>,
): readonly BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const fighter of input.fighters) {
    if (fighter.hp < 1) continue;
    const items = fighter.effects.advanceOnAction(input.nowMs, input.jumpSeconds);
    events.push(...applyPeriodicItems(fighter, items, input.random, input.rules, input.sources));
  }
  return events;
}

export type FighterTimerTicks = Readonly<{ fighter: Fighter; events: readonly BattleEvent[] }>;

/** The battle timer: real time up to `nowMs` for every fighter, paired or not. */
export function advanceFightTimer(
  input: Readonly<{
    fighters: readonly Fighter[];
    nowMs: number;
    random: RandomSource;
    rules: BattleRules;
    sources: readonly Fighter[];
  }>,
): readonly FighterTimerTicks[] {
  const ticked: FighterTimerTicks[] = [];
  for (const fighter of input.fighters) {
    if (fighter.hp < 1) continue;
    const items = fighter.effects.advanceOnTimer(input.nowMs);
    if (items.length === 0) continue;
    ticked.push({
      fighter,
      events: applyPeriodicItems(fighter, items, input.random, input.rules, input.sources),
    });
  }
  return ticked;
}

export type ActionClockResult = Readonly<{
  events: readonly BattleEvent[];
  finished: boolean;
  selfKilled: boolean;
}>;

/**
 * A human's turn-ending action moved the clock of his duel. A tick that emptied the last
 * fighter of a side ends the fight; one that killed only the actor hands his place over.
 */
export function advanceActionClock(
  input: Readonly<{
    attacker: HumanFighter;
    victim: Fighter;
    victimKilledByHit: boolean;
    turnElapsedMs: number;
    nowMs: number;
    rules: BattleRules;
    random: RandomSource;
    roster: Roster;
    fightId: string;
  }>,
): ActionClockResult {
  const events: BattleEvent[] = [
    ...advanceDuelClock({
      fighters: [input.attacker, input.victim],
      nowMs: input.nowMs,
      jumpSeconds: slotJumpSeconds(input.rules, input.turnElapsedMs),
      random: input.random,
      rules: input.rules,
      sources: input.roster.all(),
    }),
  ];
  const combatants = input.roster.all();
  const victimFellToTick = !input.victimKilledByHit && input.victim.hp === 0;
  if (victimFellToTick && enemySideCleared(input.victim.team, combatants)) {
    events.push({ type: "finished", winnerTeam: input.attacker.team, fightId: input.fightId });
    return { events, finished: true, selfKilled: false };
  }
  if (input.attacker.hp > 0) return { events, finished: false, selfKilled: false };
  const lost = enemySideCleared(input.attacker.team, combatants);
  if (lost) {
    events.push({
      type: "finished",
      winnerTeam: opposingTeam(input.attacker.team),
      fightId: input.fightId,
    });
  }
  return { events, finished: lost, selfKilled: true };
}
