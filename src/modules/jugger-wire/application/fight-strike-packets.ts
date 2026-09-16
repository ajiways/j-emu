import type { CombatEvent } from "../../combat/ports/combat-port.ts";
import { fightCastEvent } from "./fight-cast-wire.ts";
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
    const purges = consumePurges(events, index + 3);
    return {
      frame: fightEventMap([...strikePackets(next, damage, patch), ...purges]),
      consumed: 2 + purges.length,
    };
  }
  if (next?.type !== "damage") return null;
  const purges = consumePurges(events, index + 2);
  return {
    frame: fightEventMap([...strikePackets(null, next, patch), ...purges]),
    consumed: 1 + purges.length,
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

export function consumePurges(
  events: readonly CombatEvent[],
  start: number,
): readonly ReturnType<typeof fightEffectPurgeEvent>[] {
  const packets: ReturnType<typeof fightEffectPurgeEvent>[] = [];
  let index = start;
  while (events[index]?.type === "effect-purge") {
    const purge = events[index];
    if (!purge || purge.type !== "effect-purge") {
      throw new Error("effect-purge is missing after melee damage");
    }
    packets.push(fightEffectPurgeEvent(purge));
    index += 1;
  }
  return packets;
}
