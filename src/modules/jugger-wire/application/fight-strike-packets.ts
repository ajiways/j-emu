import type { CombatEvent } from "../../combat/ports/combat-port.ts";
import { fightCastEvent, fightSiblingHpChangeEvent } from "./fight-cast-wire.ts";
import { fightEffectPurgeEvent, fightPersCpEvent } from "./fight-effect-wire.ts";
import { fightEventMap } from "./fight-event-map.ts";
import { huntPersChangeEvents } from "./hunt-fight-pers-wire.ts";
import type { FightWireFrame } from "./fight-wire-event.ts";

type PersChangeEvent = Extract<CombatEvent, { type: "pers-change" }>;
type TurnWaitEvent = Extract<CombatEvent, { type: "turn-wait" }>;
type DamageEvent = Extract<CombatEvent, { type: "damage" }>;

export function mergePersChangeStrike(
  patch: PersChangeEvent,
  events: readonly CombatEvent[],
  index: number,
): Readonly<{ frame: FightWireFrame; consumed: number }> | null {
  const next = events[index + 1];
  if (next?.type === "turn-wait") {
    const damage = events[index + 2];
    if (!damage || damage.type !== "damage") {
      throw new Error("turn-wait must precede damage");
    }
    const followers = consumeMeleeFollowers(events, index + 3);
    return {
      frame: fightEventMap([...strikePackets(next, damage, patch), ...followers]),
      consumed: 2 + followers.length,
    };
  }
  if (next?.type !== "damage") return null;
  const followers = consumeMeleeFollowers(events, index + 2);
  return {
    frame: fightEventMap([...strikePackets(null, next, patch), ...followers]),
    consumed: 1 + followers.length,
  };
}

export function strikePackets(
  wait: TurnWaitEvent | null,
  damage: DamageEvent,
  patch: PersChangeEvent | null,
): readonly Readonly<Record<string, unknown>>[] {
  return [
    ...(wait ? [{ et: "attackwait", restTime: wait.timeoutSeconds }] : []),
    ...(patch ? huntPersChangeEvents(patch) : []),
    fightCastEvent(damage),
    ...(damage.comboCp !== undefined ? [fightPersCpEvent(damage.comboCp)] : []),
  ];
}

export function consumeMeleeFollowers(
  events: readonly CombatEvent[],
  start: number,
): readonly Readonly<Record<string, unknown>>[] {
  const packets: Readonly<Record<string, unknown>>[] = [];
  let index = start;
  while (true) {
    const next = events[index];
    if (next?.type === "effect-purge") {
      packets.push(fightEffectPurgeEvent(next));
      index += 1;
      continue;
    }
    if (next?.type === "damage" && next.animation === "") {
      packets.push(fightSiblingHpChangeEvent(next));
      index += 1;
      continue;
    }
    break;
  }
  return packets;
}
