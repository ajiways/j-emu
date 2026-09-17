import type { CombatEvent, FightExit, FightStart } from "../../combat/ports/combat-port.ts";
import { fightCastEvent } from "./fight-cast-wire.ts";
import { fightBuffCastEvent, fightEffectUseEvent, fightPersCpEvent } from "./fight-effect-wire.ts";
import { fightEventMap } from "./fight-event-map.ts";
import {
  consumeMeleeFollowers,
  mergePersChangeStrike,
  strikePackets,
} from "./fight-strike-packets.ts";
import { encodeFightWireEvent, type FightWireFrame } from "./fight-wire-event.ts";

export type FightConfHeroLook = Readonly<{ heroSkill: number; heroBody: string }>;

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
    overlay: FightConfHeroLook &
      Readonly<{ canLeave?: 0 | 1; instanceId?: string; flags?: string }>,
  ): FightConfigurationBlock {
    return this.configuration(start, this.policy.isPvp, this.policy.type, overlay);
  }

  friendlyDuelConfiguration(start: FightStart, look: FightConfHeroLook): FightConfigurationBlock {
    return this.configuration(start, 1, "6", look);
  }

  pvpConfiguration(
    start: FightStart,
    overlay: FightConfHeroLook & Readonly<{ instanceId: string; flags: string }>,
  ): FightConfigurationBlock {
    return this.configuration(start, 1, "1", {
      canLeave: 1,
      instanceId: overlay.instanceId,
      flags: overlay.flags,
      heroSkill: overlay.heroSkill,
      heroBody: overlay.heroBody,
    });
  }

  private configuration(
    start: FightStart,
    isPvp: 0 | 1,
    type: string,
    overlay: FightConfHeroLook &
      Readonly<{ canLeave?: 0 | 1; instanceId?: string; flags?: string }>,
  ): FightConfigurationBlock {
    if (!overlay.heroBody) throw new Error("Fight conf heroBody is required");
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
        persSelf_sk: overlay.heroSkill,
        persSelf_body: overlay.heroBody,
        auto_fight: this.policy.autoFight,
        can_leave: overlay.canLeave !== undefined ? overlay.canLeave : this.policy.canLeave,
        companion_enabled: this.policy.companionEnabled,
        is_pvp: isPvp,
        instance_id: overlay.instanceId !== undefined ? overlay.instanceId : this.policy.instanceId,
        type,
        is_slaughter: this.policy.isSlaughter,
        flags: overlay.flags !== undefined ? overlay.flags : this.policy.flags,
      },
    };
  }

  frames(events: readonly CombatEvent[]): FightWireFrame[] {
    const frames: FightWireFrame[] = [];
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      if (!event) throw new Error("Fight wire event is missing");
      if (event.type === "pers-change") {
        const merged = mergePersChangeStrike(event, events, index);
        if (merged) {
          frames.push(merged.frame);
          index += merged.consumed;
          continue;
        }
      }
      if (event.type === "turn-wait") {
        const damage = events[index + 1];
        if (!damage || damage.type !== "damage") {
          throw new Error("turn-wait must precede damage");
        }
        const followers = consumeMeleeFollowers(events, index + 2);
        frames.push(fightEventMap([...strikePackets(event, damage, null), ...followers]));
        index += 1 + followers.length;
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
      frames.push(encodeFightWireEvent(event));
    }
    return frames;
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
