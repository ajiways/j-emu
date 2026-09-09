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
  nextFightId(): Promise<string>;
  startHunt(input: {
    accountId: number;
    heroId: number;
    heroNick: string;
    heroLevel: number;
    heroKind: number;
    heroHp: number;
    fightId: string;
    botId: number;
    botNick: string;
    botLevel: number;
    botHp: number;
    arena: string;
    areaId: string;
  }): Promise<FightStart>;
  execute(accountId: number, command: FightCommand): Promise<readonly CombatEvent[]>;
  activeFightId(accountId: number): Promise<string | null>;
  accountForFight(fightId: string): Promise<number | null>;
  takeExit(accountId: number): Promise<FightExit | null>;
  peekExit(accountId: number): Promise<FightExit | null>;
}
