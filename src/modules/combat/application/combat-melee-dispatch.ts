import type { Battle } from "../domain/battle.ts";
import { persChangeForHit } from "../domain/melee-pers-change.ts";
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
  accountId: number,
  sequence: string | number,
  events: readonly CombatEvent[],
): void {
  if (events[0]?.type !== "turn-wait" || events[1]?.type !== "damage") {
    throw new Error("Player melee must emit turn-wait then damage");
  }
  enqueue(accountId, [
    ...events.filter((event) => event.type !== "finished"),
    { type: "command-accepted", sequence },
    ...events.filter((event) => event.type === "finished"),
  ]);
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

function persChangeFromDamage(
  battle: Battle,
  damage: CombatEvent | undefined,
): Extract<CombatEvent, { type: "pers-change" }> | null {
  if (!damage || damage.type !== "damage") return null;
  const roster = battle.boardParticipants();
  return persChangeForHit(roster.humans, roster.bots, damage.sourceId, damage.targetId);
}
