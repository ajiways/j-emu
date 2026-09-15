import type { FinishedFightRecord } from "./finished-fight-record.ts";
import type { RunnedFightRecord } from "./runned-fight-record.ts";

export type FightInfoCard = Readonly<{
  fightId: string;
  title: string;
  type: number;
  started: string;
  duration: number;
  timeout: number;
  areaId: string;
  live: boolean;
  winner?: 1 | 2;
  teams: Readonly<{
    "1": readonly FightInfoMember[];
    "2": readonly FightInfoMember[];
  }>;
}>;

export type FightInfoMember = Readonly<{
  nick: string;
  level: string;
  bot: 0 | 1;
}>;

export function fightInfoFromRunned(row: RunnedFightRecord): FightInfoCard {
  return {
    fightId: String(row.id),
    title: row.title,
    type: row.type,
    started: row.started,
    duration: row.duration,
    timeout: row.timeout,
    areaId: row.areaId,
    live: true,
    teams: {
      "1": row.teams["1"].map(memberOf),
      "2": row.teams["2"].map(memberOf),
    },
  };
}

export function fightInfoFromFinished(row: FinishedFightRecord): FightInfoCard {
  return {
    fightId: String(row.id),
    title: row.title,
    type: row.type,
    started: row.started,
    duration: row.duration,
    timeout: row.timeout,
    areaId: row.areaId,
    live: false,
    winner: row.winner,
    teams: {
      "1": row.teams["1"].map(memberOf),
      "2": row.teams["2"].map(memberOf),
    },
  };
}

function memberOf(member: { nick: string; level: number | string; bot: 0 | 1 }): FightInfoMember {
  if (!member.nick) throw new Error("Fight info member nick is required");
  return { nick: member.nick, level: String(member.level), bot: member.bot };
}
