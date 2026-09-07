import type { BattleEvent } from "../domain/battle.ts";

type CommandSequence = string | number;

export type FightCommand =
  | Readonly<{ kind: "authenticate"; fightId: string; sequence: CommandSequence }>
  | Readonly<{
      kind: "strike";
      side: "left" | "center" | "right";
      sequence: CommandSequence;
    }>
  | Readonly<{ kind: "poll" }>;

export type FightStart = Readonly<{
  fightId: string;
  accessKey: string;
  participantId: number;
  arena: string;
}>;

export type CombatEvent =
  | BattleEvent
  | Readonly<{ type: "command-accepted"; sequence: CommandSequence; accessKey?: string }>;

export type FightExit = Readonly<{
  fightId: string;
  winnerTeam: 1 | 2;
}>;

export interface CombatPort {
  startHunt(input: {
    accountId: string;
    heroId: string;
    heroNick: string;
    heroHp: number;
    botId: number;
    botNick: string;
    botLevel: number;
    botHp: number;
    arena: string;
  }): Promise<FightStart>;
  execute(accountId: string, command: FightCommand): Promise<readonly CombatEvent[]>;
  activeFightId(accountId: string): Promise<string | null>;
  accountForFight(fightId: string): Promise<string | null>;
  takeExit(accountId: string): Promise<FightExit | null>;
}
