import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { applyHuntBotHit } from "./battle-hunt-runtime.ts";
import { advanceFightTimer, type FighterTimerTicks } from "./duel-clock.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { FightRules } from "./fight-rules.ts";
import type { Fighter } from "./fighter.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { enemySideCleared, fightCombatants } from "./melee-target.ts";
import { persChangeForParticipants } from "./melee-pers-change.ts";
import { opposingTeam } from "./opposing-team.ts";
import type { RandomSource } from "./random-source.ts";
import { dissolveDuelContaining } from "./try-pair-hunt-queues.ts";

type EffectClockDelivery = Readonly<{ accountId: number; events: readonly BattleEvent[] }>;

export type EffectClockOutcome = Readonly<{
  deliveries: readonly EffectClockDelivery[];
  finished: Extract<BattleEvent, { type: "finished" }> | null;
  /** Humans a tick killed while the fight goes on: their place passes to a waiter. */
  fallenAccountIds: readonly number[];
  /** Humans whose foe a tick killed and who were given the next one. */
  reassignedAccountIds: readonly number[];
}>;

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
  const combatants = fightCombatants(input.humans, input.bots);
  const lost = fallen.find((fighter) => enemySideCleared(fighter.team, combatants));
  if (lost) {
    const finished = {
      type: "finished" as const,
      winnerTeam: opposingTeam(lost.team),
      fightId: input.fightId,
    };
    return { deliveries, finished, fallenAccountIds: [], reassignedAccountIds: [] };
  }
  const fallenAccountIds: number[] = [];
  const reassigned: EffectClockDelivery[] = [];
  for (const fighter of fallen) {
    if (fighter.fighterKind === "human") {
      fallenAccountIds.push(humanOf(input.humans, fighter.id).accountId);
      continue;
    }
    const hunter = pairedHuman(input, fighter.id);
    if (!hunter) {
      dissolveDuelContaining(input.duels, input.humans, fighter.id, input.bots);
      continue;
    }
    const duel = input.duels.find((entry) => entry.has(fighter.id));
    if (!duel) continue;
    const next = applyHuntBotHit(false, {
      bots: input.bots,
      enemyTeam: input.fightRules.teamAssignment.enemyTeam,
      duel,
      duels: input.duels,
      opener: hunter,
      humans: input.humans,
    });
    if (hunter.authed) reassigned.push({ accountId: hunter.accountId, events: next.events });
  }
  return {
    deliveries: [...deliveries, ...reassigned],
    finished: null,
    fallenAccountIds,
    reassignedAccountIds: reassigned.map((entry) => entry.accountId),
  };
}

function deliver(
  entry: FighterTimerTicks,
  input: Readonly<{
    humans: readonly HumanFighter[];
    bots: readonly BotFighter[];
    duels: FightDuel[];
  }>,
): readonly EffectClockDelivery[] {
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

function pairedHuman(
  input: Readonly<{ humans: readonly HumanFighter[]; duels: FightDuel[] }>,
  botId: number,
): HumanFighter | undefined {
  const duel = input.duels.find((entry) => entry.has(botId));
  if (!duel) return undefined;
  const otherId = duel.otherId(botId);
  return input.humans.find((human) => human.heroId === otherId);
}

function humanOf(humans: readonly HumanFighter[], id: number): HumanFighter {
  const human = humans.find((entry) => entry.heroId === id);
  if (!human) throw new Error(`Fight human ${id} is missing`);
  return human;
}
