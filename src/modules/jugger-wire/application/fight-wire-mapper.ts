import type { CombatEvent, FightExit, FightStart } from "../../combat/ports/combat-port.ts";
import { fightCastEvent } from "./fight-cast-wire.ts";
import {
  fightBuffCastEvent,
  fightEffectUseEvent,
  fightNativeCountEvent,
  fightPersCpEvent,
} from "./fight-effect-wire.ts";
import { fightEventMap } from "./fight-event-map.ts";
import { huntFightBootstrapEvents, huntFightRosterEvents } from "./hunt-fight-bootstrap-wire.ts";
import { friendlyFightBootstrapEvents } from "./friendly-fight-bootstrap-wire.ts";
import { huntOppNewEvent } from "./hunt-opp-new-event.ts";
import { humanOppNewEvent } from "./human-opp-new-event.ts";

export type FightConfigurationBlock = Readonly<{
  status: 100;
  conf: Readonly<{
    host: string;
    port: number;
    proxy: string;
    fightId: string;
    userId: string;
    fightAkey: string;
    bg: string;
    persSelf_sk: number;
    persSelf_body: string;
    auto_fight: number;
    can_leave: 0 | 1;
    companion_enabled: 0 | 1;
    is_pvp: 0 | 1;
    instance_id: string;
    type: string;
    is_slaughter: boolean;
    flags: string;
  }>;
}>;

type FightWireFrame =
  | Readonly<{ rs: true; sq: string | number; akey?: string }>
  | Readonly<{ ev: Readonly<Record<string, Readonly<Record<string, unknown>>>> }>;

export type FightExitBlock =
  | Readonly<{
      status: 100;
      type: 0;
      fight_id: string;
      winner: 1 | 2;
    }>
  | Readonly<{
      flee: true;
      status: 100;
      type: 2;
    }>;

export class FightWireMapper {
  constructor(
    private readonly transport: Readonly<{
      host: string;
      port: number;
      proxyPath: string;
    }>,
    private readonly policy: Readonly<{
      heroSkill: number;
      heroBody: string;
      autoFight: number;
      canLeave: 0 | 1;
      companionEnabled: 0 | 1;
      isPvp: 0 | 1;
      instanceId: string;
      type: string;
      isSlaughter: boolean;
      flags: string;
    }>,
  ) {}

  fightConfiguration(
    start: FightStart,
    overlay: Readonly<{ canLeave?: 0 | 1; instanceId?: string }> = {},
  ): FightConfigurationBlock {
    return this.configuration(start, this.policy.isPvp, this.policy.type, overlay);
  }

  friendlyDuelConfiguration(start: FightStart): FightConfigurationBlock {
    return this.configuration(start, 1, "6");
  }

  private configuration(
    start: FightStart,
    isPvp: 0 | 1,
    type: string,
    overlay: Readonly<{ canLeave?: 0 | 1; instanceId?: string }> = {},
  ): FightConfigurationBlock {
    return {
      status: 100,
      conf: {
        host: this.transport.host,
        port: this.transport.port,
        proxy: this.transport.proxyPath,
        fightId: start.fightId,
        userId: String(start.participantId),
        fightAkey: start.accessKey,
        bg: start.arena,
        persSelf_sk: this.policy.heroSkill,
        persSelf_body: this.policy.heroBody,
        auto_fight: this.policy.autoFight,
        can_leave: overlay.canLeave !== undefined ? overlay.canLeave : this.policy.canLeave,
        companion_enabled: this.policy.companionEnabled,
        is_pvp: isPvp,
        instance_id: overlay.instanceId !== undefined ? overlay.instanceId : this.policy.instanceId,
        type,
        is_slaughter: this.policy.isSlaughter,
        flags: this.policy.flags,
      },
    };
  }

  frames(events: readonly CombatEvent[]): FightWireFrame[] {
    const frames: FightWireFrame[] = [];
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      if (!event) throw new Error("Fight wire event is missing");
      if (event.type === "turn-wait") {
        const damage = events[index + 1];
        if (!damage || damage.type !== "damage") {
          throw new Error("turn-wait must precede damage");
        }
        const packets = [
          { et: "attackwait", restTime: event.timeoutSeconds },
          fightCastEvent(damage),
          ...(damage.comboCp !== undefined ? [fightPersCpEvent(damage.comboCp)] : []),
        ];
        frames.push(fightEventMap(packets));
        index += 1;
        continue;
      }
      if (event.type === "effect-use") {
        const packets: Readonly<Record<string, unknown>>[] = [fightEffectUseEvent(event)];
        let consumed = 0;
        const next = events[index + 1];
        if (next?.type === "buff-cast" || next?.type === "damage") {
          packets.push(next.type === "buff-cast" ? fightBuffCastEvent(next) : fightCastEvent(next));
          consumed += 1;
        }
        const after = events[index + 1 + consumed];
        if (after?.type === "pers-cp") {
          packets.push(fightPersCpEvent(after.cp));
          consumed += 1;
        }
        frames.push(fightEventMap(packets));
        index += consumed;
        continue;
      }
      frames.push(this.event(event));
    }
    return frames;
  }

  event(event: CombatEvent): FightWireFrame {
    switch (event.type) {
      case "command-accepted":
        return {
          rs: true,
          sq: event.sequence,
          ...(event.accessKey ? { akey: event.accessKey } : {}),
        };
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
      case "buff-cast":
        return fightEventMap([fightBuffCastEvent(event)]);
      case "pers-cp":
        return fightEventMap([fightPersCpEvent(event.cp)]);
      case "native-count":
        return fightEventMap([fightNativeCountEvent(event)]);
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
      case "finished":
        return fightEventMap([{ et: "fightFinish", winner: event.winnerTeam }]);
    }
  }

  exit(exit: FightExit): FightExitBlock {
    if (exit.flee) {
      return { flee: true, status: 100, type: 2 };
    }
    return {
      status: 100,
      type: 0,
      fight_id: exit.fightId,
      winner: exit.winnerTeam,
    };
  }
}
