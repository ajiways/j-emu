import type { CombatEvent, FightExit, FightStart } from "../../combat/ports/combat-port.ts";

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

type FightCommandAcceptedFrame = Readonly<{
  rs: true;
  sq: string | number;
  akey?: string;
}>;

type FightOpponentFrame = Readonly<{
  oppnew: Readonly<{
    id: number;
    nick: string;
    hp: number;
    maxHp: number;
    level: number;
    team: 2;
  }>;
}>;

type FightDamageFrame = Readonly<{
  cast: Readonly<{
    srcId: number;
    dstId: number;
    anim: string;
    hpChange: number;
    react: 2 | 10;
  }>;
}>;

type FightTurnFrame = Readonly<{ attacknow: Readonly<{ timeout: number }> }>;

type FightFinishedFrame = Readonly<{
  fightFinish: Readonly<{
    winner: string;
    fight_id: string;
  }>;
}>;

type FightWireEvent =
  | FightCommandAcceptedFrame
  | FightOpponentFrame
  | FightDamageFrame
  | FightTurnFrame
  | FightFinishedFrame;

export type FightExitBlock = Readonly<{
  status: 100;
  type: 0;
  fight_id: string;
  winner: 1 | 2;
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

  fightConfiguration(start: FightStart): FightConfigurationBlock {
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
        can_leave: this.policy.canLeave,
        companion_enabled: this.policy.companionEnabled,
        is_pvp: this.policy.isPvp,
        instance_id: this.policy.instanceId,
        type: this.policy.type,
        is_slaughter: this.policy.isSlaughter,
        flags: this.policy.flags,
      },
    };
  }

  event(event: CombatEvent): FightWireEvent {
    switch (event.type) {
      case "command-accepted":
        return {
          rs: true,
          sq: event.sequence,
          ...(event.accessKey ? { akey: event.accessKey } : {}),
        };
      case "opponent-introduced":
        return {
          oppnew: {
            id: event.id,
            nick: event.nick,
            hp: event.hp,
            maxHp: event.maxHp,
            level: event.level,
            team: event.team,
          },
        };
      case "damage":
        return {
          cast: {
            srcId: event.sourceId,
            dstId: event.targetId,
            anim: event.animation,
            hpChange: event.hpChange,
            react: event.killed ? 10 : 2,
          },
        };
      case "turn-granted":
        return { attacknow: { timeout: event.timeoutSeconds } };
      case "finished":
        return {
          fightFinish: {
            winner: String(event.winnerTeam),
            fight_id: event.fightId,
          },
        };
    }
  }

  exit(exit: FightExit): FightExitBlock {
    return {
      status: 100,
      type: 0,
      fight_id: exit.fightId,
      winner: exit.winnerTeam,
    };
  }
}
