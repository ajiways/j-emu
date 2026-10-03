import type { BattleEvent } from "./battle-event.ts";
import type { BotFighter } from "./bot-fighter.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { Participant } from "./participant.ts";
import { dissolveDuelAt } from "./pairing.ts";
import type { RandomSource } from "./random-source.ts";
import { rollDuelOpener } from "./roll-duel-opener.ts";
import {
  PAIR_HITS_TO_SWITCH,
  planShuffle,
  type ShuffleOutcome,
  type ShuffleTell,
} from "./try-shuffle-after-hits.ts";

type ShuffleInput = Readonly<{
  /** The player whose strike may end his duel's turn at the foe. */
  actor: HumanFighter;
  humans: readonly HumanFighter[];
  bots: readonly BotFighter[];
  duels: FightDuel[];
  finished: boolean;
  openingRandom: RandomSource;
}>;

function isHuman(participant: Participant): participant is HumanFighter {
  return participant.fighterKind === "human";
}

/** What a participant is told when `opponent` stands across from him from now on. */
function newOpponent(opponent: Participant): BattleEvent {
  if (isHuman(opponent)) {
    return {
      type: "opponent-new-human",
      human: opponent.snapshot(),
      appearance: opponent.appearance,
    };
  }
  return { type: "opponent-new", bot: (opponent as BotFighter).snap() };
}

/** Tells a player something; a mob is not told, it has no client. */
function tell(participant: Participant, events: readonly BattleEvent[]): readonly ShuffleTell[] {
  return isHuman(participant) && participant.authed
    ? [{ accountId: participant.accountId, events }]
    : [];
}

/** The player of a duel's sides whose client opens it: one is enough, mobs act by the fight clock. */
function starter(...sides: readonly Participant[]): readonly number[] {
  const human = sides.find((side): side is HumanFighter => isHuman(side) && side.authed);
  return human ? [human.accountId] : [];
}

function sidesOf(duel: FightDuel, everyone: readonly Participant[]): readonly Participant[] {
  return everyone.filter((entry) => duel.has(entry.id));
}

/** An ally of `team` fighting a living foe in another duel, with the foe: whom the actor may swap with. */
function allyDuel(
  duels: readonly FightDuel[],
  actorDuel: FightDuel,
  everyone: readonly Participant[],
  team: 1 | 2,
): Readonly<{ duel: FightDuel; ally: Participant; foe: Participant }> | null {
  for (const duel of duels) {
    if (duel === actorDuel) continue;
    const sides = sidesOf(duel, everyone);
    const ally = sides.find((side) => side.team === team && !side.waiting && side.alive);
    const foe = sides.find((side) => side.team !== team && side.alive);
    if (ally && foe) return { duel, ally, foe };
  }
  return null;
}

/**
 * The shuffle of the duel `actor` stands in, once both sides have struck enough. Whoever stands in
 * it, a player or a mob, the rules are the same: the actor steps out for a waiting ally, or the
 * foe is changed for the next waiting enemy, or the foes of two duels are swapped. Players are told
 * of their new opponent; mobs act by the fight clock.
 */
export function shuffleAfterHits(input: ShuffleInput): ShuffleOutcome {
  const { actor, humans, bots, duels, openingRandom } = input;
  const everyone: readonly Participant[] = [...humans, ...bots];
  const duel = duels.find((entry) => entry.has(actor.id));
  const foe = duel ? everyone.find((entry) => entry.id === duel.otherId(actor.id)) : undefined;
  if (!duel || !foe) return { kind: "none" };
  const waiter =
    humans.find((entry) => entry.waiting && entry.alive && entry.team === actor.team) ??
    bots.find((entry) => entry.waiting && entry.alive && entry.team === actor.team);
  const partner = allyDuel(duels, duel, everyone, actor.team);
  const swappable =
    partner &&
    partner.duel.hitsA >= PAIR_HITS_TO_SWITCH &&
    partner.duel.hitsB >= PAIR_HITS_TO_SWITCH
      ? partner
      : null;
  const reserve = nextEnemy(foe, everyone, duels);
  const plan = planShuffle({
    humanHits: duel.hitsFor(actor.id),
    botHits: duel.hitsFor(foe.id),
    hasLivingWaiter: waiter !== undefined,
    hasSwappableOther: swappable !== null,
    hasLivingReserve: reserve !== null,
    finished: input.finished || foe.hp === 0,
  });
  if (plan === "none") return { kind: "none" };
  actor.markFought(foe.id);
  foe.markFought(actor.id);
  if (plan === "cross-swap" && swappable) {
    const { duel: other, ally, foe: otherFoe } = swappable;
    ally.markFought(otherFoe.id);
    otherFoe.markFought(ally.id);
    duel.replace(foe.id, otherFoe.id);
    other.replace(otherFoe.id, foe.id);
    duel.resetHits();
    other.resetHits();
    rollDuelOpener(duel, { holder: actor, other: otherFoe, random: openingRandom });
    rollDuelOpener(other, { holder: ally, other: foe, random: openingRandom });
    return {
      kind: plan,
      tells: [
        ...tell(actor, [newOpponent(otherFoe)]),
        ...tell(ally, [newOpponent(foe)]),
        ...tell(foe, [newOpponent(ally)]),
        ...tell(otherFoe, [newOpponent(actor)]),
      ],
      starts: [...starter(actor, otherFoe), ...starter(ally, foe)],
      affected: [actor, ally, foe, otherFoe].filter(isHuman).map((human) => human.accountId),
    };
  }
  if (plan === "reserve-swap" && reserve) {
    return swapFoe(input, { duel, foe, next: reserve.next, stolenFrom: reserve.stolenFrom });
  }
  if (!waiter) throw new Error("Shuffle waiter-handoff requires a living waiter");
  actor.unpair();
  waiter.pair();
  duel.replace(actor.id, waiter.id);
  duel.resetHits();
  rollDuelOpener(duel, { holder: waiter, other: foe, random: openingRandom });
  return {
    kind: "waiter-handoff",
    tells: [
      ...tell(actor, [{ type: "opponent-wait" }]),
      ...tell(waiter, [newOpponent(foe)]),
      ...tell(foe, [newOpponent(waiter)]),
    ],
    starts: starter(waiter, foe),
    affected: [actor, waiter, foe].filter(isHuman).map((human) => human.accountId),
  };
}

/** The enemy who comes next across from the actor: one waiting, or one of a duel of mobs only. */
function nextEnemy(
  foe: Participant,
  everyone: readonly Participant[],
  duels: readonly FightDuel[],
): Readonly<{ next: Participant; stolenFrom: number | null }> | null {
  const waiting = everyone.find(
    (entry) => entry.waiting && entry.alive && entry.team === foe.team && entry.id !== foe.id,
  );
  if (waiting) return { next: waiting, stolenFrom: null };
  for (let index = duels.length - 1; index >= 0; index -= 1) {
    const duel = duels[index];
    if (!duel) throw new Error("Battle duel slot is empty");
    const sides = sidesOf(duel, everyone);
    if (sides.some(isHuman)) continue;
    const enemy = sides.find((side) => side.team === foe.team && side.alive && side.id !== foe.id);
    if (enemy) return { next: enemy, stolenFrom: index };
  }
  return null;
}

/** The foe goes to wait and the next enemy takes his place across from the actor. */
function swapFoe(
  input: ShuffleInput,
  swap: Readonly<{
    duel: FightDuel;
    foe: Participant;
    next: Participant;
    stolenFrom: number | null;
  }>,
): ShuffleOutcome {
  const { actor, openingRandom } = input;
  const { duel, foe, next } = swap;
  if (swap.stolenFrom === null) next.pair();
  else dissolveDuelAt(input.duels, swap.stolenFrom, [...input.humans, ...input.bots], next.id);
  foe.unpair();
  duel.replace(foe.id, next.id);
  duel.resetHits();
  rollDuelOpener(duel, { holder: actor, other: next, random: openingRandom });
  return {
    kind: "reserve-swap",
    tells: [
      ...tell(actor, [newOpponent(next)]),
      ...tell(foe, [{ type: "opponent-wait" }]),
      ...tell(next, [newOpponent(actor)]),
    ],
    starts: starter(actor, next),
    affected: [actor, foe, next].filter(isHuman).map((human) => human.accountId),
  };
}

/**
 * A participant has fallen (or walked out of) his duel: a waiting ally of his team takes his place
 * across from the foe, or, with none, the duel is dissolved and the foe waits. Whoever the fallen
 * and the foe are, a player or a mob, the rule is the same.
 */
export function replaceFallen(
  input: Readonly<{
    dead: HumanFighter;
    humans: readonly HumanFighter[];
    bots: readonly BotFighter[];
    duels: FightDuel[];
    /** Whether the fight lets a waiting ally step in (`FightRules.pairsNextWaiter`). */
    pairsWaiters: boolean;
    openingRandom: RandomSource;
  }>,
): Exclude<ShuffleOutcome, { kind: "none" }> | null {
  const { dead, duels } = input;
  const everyone: readonly Participant[] = [...input.humans, ...input.bots];
  const index = duels.findIndex((entry) => entry.has(dead.id));
  const duel = duels[index];
  if (!duel) return null;
  const foe = everyone.find((entry) => entry.id === duel.otherId(dead.id));
  if (!foe) throw new Error(`Duel of ${dead.id} has no foe`);
  const waiter = input.pairsWaiters
    ? everyone.find(
        (entry) => entry.waiting && entry.alive && entry.team === dead.team && entry.id !== dead.id,
      )
    : undefined;
  if (!waiter) {
    dissolveDuelAt(duels, index, everyone, null);
    return {
      kind: "waiter-handoff",
      tells: tell(foe, [{ type: "opponent-wait" }]),
      starts: [],
      affected: isHuman(foe) ? [foe.accountId] : [],
    };
  }
  waiter.pair();
  duel.replace(dead.id, waiter.id);
  duel.resetHits();
  rollDuelOpener(duel, { holder: waiter, other: foe, random: input.openingRandom });
  return {
    kind: "waiter-handoff",
    tells: [...tell(waiter, [newOpponent(foe)]), ...tell(foe, [newOpponent(waiter)])],
    starts: starter(waiter, foe),
    affected: [waiter, foe].filter(isHuman).map((human) => human.accountId),
  };
}
