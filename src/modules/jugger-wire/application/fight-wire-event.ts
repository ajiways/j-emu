import type { CombatEvent } from "../../combat/ports/combat-port.ts";
import { fightCastEvent } from "./fight-cast-wire.ts";
import {
  fightBuffCastEvent,
  fightEffectPurgeEvent,
  fightEffectUseEvent,
  fightPersCpEvent,
  fightPersEffSnapshotEvents,
} from "./fight-effect-wire.ts";
import { fightEventMap } from "./fight-event-map.ts";
import { huntFightBootstrapEvents, huntFightRosterEvents } from "./hunt-fight-bootstrap-wire.ts";
import { huntPersChangeEvents } from "./hunt-fight-pers-wire.ts";
import { huntPersSpellsEvent } from "./hunt-fight-pers-spells.ts";
import { friendlyFightBootstrapEvents } from "./friendly-fight-bootstrap-wire.ts";
import { huntOppNewEvent } from "./hunt-opp-new-event.ts";
import { humanOppNewEvent } from "./human-opp-new-event.ts";

export type FightWireFrame =
  | Readonly<{ rs: true; sq: string | number; akey?: string }>
  | Readonly<{ rs: false; err: string; sq: string | number }>
  | Readonly<{ ev: Readonly<Record<string, Readonly<Record<string, unknown>>>> }>;

export function encodeFightWireEvent(event: CombatEvent): FightWireFrame {
  switch (event.type) {
    case "command-accepted":
      return {
        rs: true,
        sq: event.sequence,
        ...(event.accessKey ? { akey: event.accessKey } : {}),
      };
    case "command-denied":
      return { rs: false, err: event.err, sq: event.sequence };
    case "hunt-bootstrap":
      return fightEventMap(huntFightBootstrapEvents(event));
    case "friendly-bootstrap":
      return fightEventMap(friendlyFightBootstrapEvents(event));
    case "roster-updated":
      return fightEventMap(huntFightRosterEvents(event));
    case "damage":
      return fightEventMap([
        fightCastEvent(event),
        ...(event.comboCp !== undefined ? [fightPersCpEvent(event.comboCp)] : []),
      ]);
    case "effect-use":
      return fightEventMap([fightEffectUseEvent(event)]);
    case "effect-purge":
      return fightEventMap([fightEffectPurgeEvent(event)]);
    case "buff-cast":
      return fightEventMap([fightBuffCastEvent(event)]);
    case "pers-cp":
      return fightEventMap([fightPersCpEvent(event.cp)]);
    case "native-count":
      if (event.srcId !== 7) {
        throw new Error(`native-count srcId must be 7, got ${event.srcId}`);
      }
      return fightEventMap([huntPersSpellsEvent(event.loadout, event.count)]);
    case "turn-granted":
      return fightEventMap([{ et: "attacknow", restTime: event.timeoutSeconds }]);
    case "turn-wait":
      throw new Error("turn-wait must be encoded with the following damage event");
    case "opponent-new":
      return fightEventMap([huntOppNewEvent(event.bot)]);
    case "opponent-new-human":
      return fightEventMap([humanOppNewEvent(event.human, event.appearance)]);
    case "opponent-wait":
      return fightEventMap([{ et: "oppwait" }]);
    case "pers-change":
      return fightEventMap(huntPersChangeEvents(event));
    case "pers-effects":
      return fightEventMap(fightPersEffSnapshotEvents(event.persId, event.effects));
    case "finished":
      return fightEventMap([{ et: "fightFinish", winner: event.winnerTeam }]);
  }
}
