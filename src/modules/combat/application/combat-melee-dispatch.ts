import type { Battle } from "../domain/battle.ts";
import type { EndingGloveResult } from "../domain/glove-ending-cast.ts";
import { persChangeForHit, persChangeForParticipants } from "../domain/melee-pers-change.ts";
import type { ShuffleOutcome } from "../domain/try-shuffle-after-hits.ts";
import type { CombatEvent } from "../ports/combat-port.ts";
import type { FightScheduler } from "./fight-scheduler.ts";

export function fanoutRosterEffects(
  battle: Battle,
  actorAccountId: number,
  events: readonly CombatEvent[],
  enqueue: (accountId: number, events: readonly CombatEvent[], at?: "head" | "tail") => void,
  wakeAccount: (accountId: number) => void,
): void {
  const humans = battle.boardParticipants().humans;
  const foeId = battle.foeIdOf(actorAccountId);
  const pair = foeId === null ? null : battle.accountOfParticipant(foeId);
  for (const accountId of battle.authedAccountIds()) {
    if (accountId === actorAccountId) continue;
    const heroId = humans.find((human) => human.accountId === accountId)?.heroId;
    // Whoever a buff lands on, and the player across from the caster, see the cast animation too.
    const shown = events.filter(
      (event) =>
        event.type === "effect-use" ||
        event.type === "effect-purge" ||
        (event.type === "buff-cast" && (event.targetId === heroId || accountId === pair)),
    );
    if (shown.length === 0) continue;
    enqueue(accountId, shown);
    wakeAccount(accountId);
  }
}

/** The hero's emblems that fire as his turn begins: he and the roster see what they put on him. */
export function deliverTurnEmblems(
  battle: Battle,
  accountId: number,
  nowMs: number,
  enqueue: (accountId: number, events: readonly CombatEvent[], at?: "head" | "tail") => void,
  wakeAccount: (accountId: number) => void,
): void {
  const fired = battle.fireTurnEmblems(accountId, nowMs);
  if (fired.length > 0) deliverEffects(battle, accountId, fired, enqueue, wakeAccount);
}

/** Sends the events to the acting fighter and shows their effect changes to everyone else. */
export function deliverEffects(
  battle: Battle,
  accountId: number,
  events: readonly CombatEvent[],
  enqueue: (accountId: number, events: readonly CombatEvent[], at?: "head" | "tail") => void,
  wakeAccount: (accountId: number) => void,
): void {
  enqueue(accountId, events);
  fanoutRosterEffects(battle, accountId, events, enqueue, wakeAccount);
  wakeAccount(accountId);
}

export function delayTokensByAccount(battle: Battle): ReadonlyMap<number, string> {
  const tokens = new Map<number, string>();
  for (const accountId of battle.accountIds()) {
    const token = battle.delayTokenFor(accountId);
    if (token) tokens.set(accountId, token);
  }
  return tokens;
}

export function cancelDuel(scheduler: FightScheduler, battle: Battle, accountId: number): void {
  const token = battle.delayTokenFor(accountId);
  if (token) scheduler.cancel(token);
}

export function enqueuePlayerMelee(
  enqueue: (accountId: number, events: readonly CombatEvent[], at?: "head" | "tail") => void,
  battle: Battle,
  accountId: number,
  sequence: string | number,
  events: readonly CombatEvent[],
): void {
  if (events[0]?.type !== "turn-wait" || events[1]?.type !== "damage") {
    throw new Error("Player melee must emit turn-wait then damage");
  }
  enqueue(accountId, [
    ...events.filter((event) => event.type !== "finished"),
    ...actorPersChange(battle, events),
    { type: "command-accepted", sequence },
    ...events.filter((event) => event.type === "finished"),
  ]);
}

/** What a hit shows the rest of the roster: fresh hp and the effects that appeared or went. */
export function fanoutHit(
  battle: Battle,
  actorAccountId: number,
  events: readonly CombatEvent[],
  enqueue: (accountId: number, events: readonly CombatEvent[], at?: "head" | "tail") => void,
  wakeAccount: (accountId: number) => void,
): void {
  fanoutPersChange(battle, actorAccountId, events, enqueue, wakeAccount);
  fanoutRosterEffects(battle, actorAccountId, events, enqueue, wakeAccount);
}

/**
 * The blows (and heals) of an action that a player sees: those aimed at him, and all of them for
 * the player across from the actor. No turn wait, no glove combo of the actor, hp after the swing.
 */
function blowsSeenBy(
  battle: Battle,
  accountId: number,
  isPair: boolean,
  events: readonly CombatEvent[],
): readonly CombatEvent[] {
  const blows = events.flatMap((event): CombatEvent[] => {
    if (event.type !== "damage") return [];
    if (!isPair && battle.accountOfParticipant(event.targetId) !== accountId) return [];
    const blow = Object.fromEntries(Object.entries(event).filter(([key]) => key !== "comboCp"));
    return [blow as typeof event];
  });
  if (blows.length === 0) return [];
  return [...blows, ...withActorPersChange(battle, events).filter((e) => e.type === "pers-change")];
}

export function fanoutPersChange(
  battle: Battle,
  actorAccountId: number,
  events: readonly CombatEvent[],
  enqueue: (accountId: number, events: readonly CombatEvent[], at?: "head" | "tail") => void,
  wakeAccount: (accountId: number) => void,
  skipAccountIds: ReadonlySet<number> = new Set(),
): void {
  const patch =
    events.find((event) => event.type === "pers-change") ??
    persChangeFromDamage(
      battle,
      events.find((event) => event.type === "damage"),
    );
  if (!patch) return;
  const foeId = battle.foeIdOf(actorAccountId);
  const pair = foeId === null ? null : battle.accountOfParticipant(foeId);
  for (const accountId of battle.authedAccountIds()) {
    if (accountId === actorAccountId || skipAccountIds.has(accountId)) continue;
    // The player struck across from the actor sees the swing land, not only the fresh hit points.
    const blows = blowsSeenBy(battle, accountId, accountId === pair, events);
    if (blows.length > 0) enqueue(accountId, blows);
    else enqueue(accountId, [patch], "head");
    wakeAccount(accountId);
  }
}

/**
 * The acting client also needs the fresh hp and dealt-damage totals after a hit (the live server
 * sends them to everyone, actor included); the hit's own events do not carry them. They go after
 * the swing: ahead of it the client would take the hp off before the blow lands.
 */
function actorPersChange(battle: Battle, events: readonly CombatEvent[]): readonly CombatEvent[] {
  if (events.some((event) => event.type === "pers-change")) return [];
  const hit = events.find((event) => event.type === "damage" && event.animation !== "");
  const patch = persChangeFromDamage(battle, hit);
  if (patch) return [patch];
  const spent = events.find((event) => event.type === "mp-change");
  if (!spent) return [];
  const roster = battle.boardParticipants();
  return [persChangeForParticipants(roster.humans, roster.bots, [spent.targetId])];
}

/** A cast that keeps the turn: accepted, the events, the fresh totals, and the effects shown to others. */
export function enqueueKeepTurn(
  enqueue: (accountId: number, events: readonly CombatEvent[], at?: "head" | "tail") => void,
  wakeAccount: (accountId: number) => void,
  battle: Battle | undefined,
  accountId: number,
  sequence: string | number,
  events: readonly CombatEvent[],
): void {
  const shown = battle ? withActorPersChange(battle, events) : events;
  enqueue(accountId, [{ type: "command-accepted", sequence }, ...shown]);
  if (!battle) return;
  fanoutPersChange(battle, accountId, events, enqueue, wakeAccount);
  fanoutRosterEffects(battle, accountId, events, enqueue, wakeAccount);
}

export function withActorPersChange(
  battle: Battle,
  events: readonly CombatEvent[],
): readonly CombatEvent[] {
  return [
    ...events.filter((event) => event.type !== "finished"),
    ...actorPersChange(battle, events),
    ...events.filter((event) => event.type === "finished"),
  ];
}

function persChangeFromDamage(
  battle: Battle,
  damage: CombatEvent | undefined,
): Extract<CombatEvent, { type: "pers-change" }> | null {
  if (!damage || damage.type !== "damage") return null;
  const roster = battle.boardParticipants();
  return persChangeForHit(roster.humans, roster.bots, damage.sourceId, damage.targetId);
}

export function deliverAggroPairs(
  input: Readonly<{
    battle: Battle;
    casterAccountId: number;
    pairedAccountIds: readonly number[];
    roster: Extract<CombatEvent, { type: "roster-updated" }> | null;
    enqueue: (accountId: number, events: readonly CombatEvent[]) => void;
    wakeAccount: (accountId: number) => void;
    grantPairedBot: (accountId: number) => void;
  }>,
): void {
  const { battle, enqueue, wakeAccount } = input;
  for (const accountId of battle.authedAccountIds()) {
    if (accountId === input.casterAccountId || !input.roster) continue;
    enqueue(accountId, [input.roster]);
    wakeAccount(accountId);
  }
  for (const accountId of input.pairedAccountIds) {
    const human = battle.livingHumans().find((entry) => entry.accountId === accountId);
    if (!human || human.waiting) continue;
    if (human.authed) {
      enqueue(accountId, [{ type: "opponent-new", bot: battle.foeBotSnap(accountId) }]);
      wakeAccount(accountId);
    }
    input.grantPairedBot(accountId);
  }
}

export function deliverGloveSides(
  input: Readonly<{
    battle: Battle;
    ending: EndingGloveResult;
    scheduler: FightScheduler;
    enqueue: (accountId: number, events: readonly CombatEvent[], at?: "head" | "tail") => void;
    wakeAccount: (accountId: number) => void;
    grantPairedBot: (accountId: number) => void;
  }>,
): void {
  for (const notify of input.ending.sideNotifies) {
    const wait = notify.events.some((event) => event.type === "opponent-wait");
    const next = notify.events.some(
      (event) => event.type === "opponent-new" || event.type === "opponent-new-human",
    );
    if (wait || next) cancelDuel(input.scheduler, input.battle, notify.accountId);
    input.enqueue(notify.accountId, notify.events, "head");
    input.wakeAccount(notify.accountId);
    if (next) input.grantPairedBot(notify.accountId);
  }
}

export function shuffleAffectedAccountIds(
  shuffle: Exclude<ShuffleOutcome, { kind: "none" }>,
): readonly number[] {
  const foe =
    shuffle.kind === "waiter-handoff" || shuffle.kind === "ally-handoff" ? shuffle.foe : undefined;
  const foes = foe ? [foe.accountId] : [];
  if (shuffle.kind === "waiter-handoff") {
    return [shuffle.actorAccountId, shuffle.waiterAccountId, ...foes];
  }
  if (shuffle.kind === "ally-handoff") return [shuffle.actorAccountId, ...foes];
  if (shuffle.kind === "reserve-swap") return [shuffle.accountId];
  return shuffle.rightAccountId === null
    ? [shuffle.leftAccountId]
    : [shuffle.leftAccountId, shuffle.rightAccountId];
}

/** What each side of a finished shuffle is told, and whose turn is granted next. */
export function deliverShuffle(
  input: Readonly<{
    battle: Battle;
    shuffle: Exclude<ShuffleOutcome, { kind: "none" }>;
    enqueue: (accountId: number, events: readonly CombatEvent[], at?: "head" | "tail") => void;
    wakeAccount: (accountId: number) => void;
    grantAfterPair: (accountId: number) => void;
    grantPairedBot: (accountId: number) => void;
  }>,
): void {
  const { shuffle, enqueue, wakeAccount } = input;
  const tell = (accountId: number, events: readonly CombatEvent[]) => {
    enqueue(accountId, events);
    wakeAccount(accountId);
  };
  if (shuffle.kind === "waiter-handoff" || shuffle.kind === "ally-handoff") {
    tell(shuffle.actorAccountId, [{ type: "opponent-wait" }]);
    if (shuffle.foe) tell(shuffle.foe.accountId, shuffle.foe.events);
    if (shuffle.kind === "waiter-handoff" && shuffle.waiterAuthed) {
      tell(shuffle.waiterAccountId, shuffle.events);
      input.grantAfterPair(shuffle.waiterAccountId);
    } else if (shuffle.foe && shuffle.kind === "ally-handoff") {
      // The duel of a player against a summoned mob has no fight clock to start it.
      input.grantAfterPair(shuffle.foe.accountId);
    }
    return;
  }
  if (shuffle.kind === "reserve-swap") {
    tell(shuffle.accountId, [{ type: "opponent-new", bot: shuffle.bot }]);
    input.grantPairedBot(shuffle.accountId);
    return;
  }
  tell(shuffle.leftAccountId, [{ type: "opponent-new", bot: shuffle.leftBot }]);
  input.grantPairedBot(shuffle.leftAccountId);
  // An ally mob on the other side needs no word: its duel goes on by the fight clock.
  if (shuffle.rightAccountId === null) return;
  tell(shuffle.rightAccountId, [{ type: "opponent-new", bot: shuffle.rightBot }]);
  input.grantPairedBot(shuffle.rightAccountId);
}

/**
 * Waiting participants the fight clock has paired: a player with a mob foe is told about it and
 * the first turn is arranged; a player with a player foe goes through the join announcement.
 */
export function deliverPairedWaiters(
  input: Readonly<{
    battle: Battle;
    accountIds: readonly number[];
    enqueue: (accountId: number, events: readonly CombatEvent[], at?: "head" | "tail") => void;
    wakeAccount: (accountId: number) => void;
    grantPairedBot: (accountId: number) => void;
    notifyJoinedPair: (accountId: number) => void;
  }>,
): void {
  for (const accountId of input.accountIds) {
    if (input.battle.pairedOpponent(accountId).kind === "human") {
      input.notifyJoinedPair(accountId);
      continue;
    }
    deliverAggroPairs({
      battle: input.battle,
      casterAccountId: accountId,
      pairedAccountIds: [accountId],
      roster: null,
      enqueue: input.enqueue,
      wakeAccount: input.wakeAccount,
      grantPairedBot: input.grantPairedBot,
    });
  }
}
