import type { BattleRules } from "./battle-rules.ts";
import { advanceFightTimer, type FighterTimerTicks } from "./duel-clock.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { FightRules } from "./fight-rules.ts";
import type { Fighter } from "./fighter.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { persChangeForParticipants } from "./melee-pers-change.ts";
import type { RandomSource } from "./random-source.ts";
import { settleFallen, type Fallout, type FalloutDelivery } from "./settle-fallen.ts";

export type EffectClockOutcome = Fallout;

export function nextEffectDueMs(fighters: readonly Fighter[]): number | null {
  let due: number | null = null;
  for (const fighter of fighters) {
    if (fighter.hp < 1) continue;
    const at = fighter.effects.nextPeriodicDueMs();
    if (at !== null && (due === null || at < due)) due = at;
  }
  return due;
}

/** The battle timer fired: real time for every effect, ticks for paired carriers, then fallout. */
export function tickFightEffects(
  input: Readonly<{
    humans: readonly HumanFighter[];
    bots: readonly BotFighter[];
    duels: FightDuel[];
    fightRules: FightRules;
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    nowMs: number;
  }>,
): EffectClockOutcome {
  const fighters: readonly Fighter[] = [
    ...input.humans.filter((human) => !human.leftLive),
    ...input.bots,
  ];
  const ticked = advanceFightTimer({
    fighters,
    inDuel: (fighter) => input.duels.some((duel) => duel.has(fighter.id)),
    nowMs: input.nowMs,
    random: input.random,
    rules: input.rules,
    sources: [...input.humans, ...input.bots],
  });
  const deliveries = ticked.flatMap((entry) => deliver(entry, input));
  const fallen = ticked.map((entry) => entry.fighter).filter((fighter) => fighter.hp < 1);
  const fallout = settleFallen(fallen, input);
  return { ...fallout, deliveries: [...deliveries, ...fallout.deliveries] };
}

function deliver(
  entry: FighterTimerTicks,
  input: Readonly<{
    humans: readonly HumanFighter[];
    bots: readonly BotFighter[];
    duels: FightDuel[];
  }>,
): readonly FalloutDelivery[] {
  const patch = persChangeForParticipants(
    input.humans,
    input.bots.map((bot) => bot.snap()),
    [
      entry.fighter.id,
      ...entry.events.flatMap((event) => (event.type === "damage" ? [event.sourceId] : [])),
    ],
  );
  const involved = new Set<number>([entry.fighter.id]);
  const duel = input.duels.find((candidate) => candidate.has(entry.fighter.id));
  if (duel) involved.add(duel.otherId(entry.fighter.id));
  return input.humans
    .filter((human) => human.authed)
    .map((human) => ({
      accountId: human.accountId,
      events: involved.has(human.heroId) ? [patch, ...entry.events] : [patch],
    }));
}
