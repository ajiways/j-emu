import type { Battle } from "../domain/battle.ts";
import type { EndingGloveResult } from "../domain/glove-ending-cast.ts";
import { persChangeForHit } from "../domain/melee-pers-change.ts";
import type { ShuffleOutcome } from "../domain/try-shuffle-after-hits.ts";
import type { CombatEvent } from "../ports/combat-port.ts";
import type { HuntMeleeScheduler } from "./hunt-melee-scheduler.ts";

export function fanoutRosterEffects(
  battle: Battle,
  actorAccountId: number,
  events: readonly CombatEvent[],
  enqueue: (accountId: number, events: readonly CombatEvent[], at?: "head" | "tail") => void,
  wakeAccount: (accountId: number) => void,
): void {
  const fx = events.filter((event) => event.type === "effect-use" || event.type === "effect-purge");
  if (fx.length === 0) return;
  for (const accountId of battle.authedAccountIds()) {
    if (accountId === actorAccountId) continue;
    enqueue(accountId, fx);
    wakeAccount(accountId);
  }
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

export function cancelDuel(scheduler: HuntMeleeScheduler, battle: Battle, accountId: number): void {
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
  for (const accountId of battle.authedAccountIds()) {
    if (accountId === actorAccountId || skipAccountIds.has(accountId)) continue;
    enqueue(accountId, [patch], "head");
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
  return patch ? [patch] : [];
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
  if (battle) fanoutRosterEffects(battle, accountId, events, enqueue, wakeAccount);
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
    scheduler: HuntMeleeScheduler;
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
  if (shuffle.kind === "waiter-handoff") return [shuffle.actorAccountId, shuffle.waiterAccountId];
  if (shuffle.kind === "reserve-swap") return [shuffle.accountId];
  return [shuffle.leftAccountId, shuffle.rightAccountId];
}
