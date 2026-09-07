import { parseDecimalId } from "../../../shared/kernel/decimal-id.ts";
import { fightStartedLabel } from "./fight-started-label.ts";
import type { FinishedFightTeams } from "./finished-fight-teams.ts";
import { huntFinishedFightTeams, parseFinishedFightTeams } from "./finished-fight-teams.ts";
import { huntFightTitle } from "./hunt-fight-title.ts";

/** Hunt `fight.type` from live fight_info dump `type:"1"` and old `fightType`. */
const HUNT_FIGHT_TYPE = 1;

/** Old `recordFinishedFight` always stored `level: 0`. */
const HUNT_HISTORY_LEVEL = 0;

export type FinishedFightRecord = Readonly<{
  id: bigint;
  accountId: string;
  heroId: string;
  title: string;
  type: number;
  timeout: number;
  levelMin: number;
  levelMax: number;
  level: number;
  mlTitle: string;
  winner: 1 | 2;
  started: string;
  duration: number;
  teams: FinishedFightTeams;
  areaId: string;
  finishedAt: Date;
}>;

export function huntFinishedFightRecord(input: {
  fightId: string;
  accountId: string;
  heroId: string;
  heroNick: string;
  heroLevel: number;
  heroKind: number;
  botId: number;
  botNick: string;
  botLevel: number;
  timeout: number;
  areaId: string;
  winner: 1 | 2;
  startedAt: Date;
  finishedAt: Date;
}): FinishedFightRecord {
  if (!input.accountId) throw new Error("Finished fight requires an account id");
  if (!input.areaId) throw new Error("Finished fight requires an area id");
  if (!Number.isInteger(input.timeout) || input.timeout < 1) {
    throw new Error("Finished fight timeout must be a positive integer");
  }
  if (input.finishedAt.getTime() < input.startedAt.getTime()) {
    throw new Error("Finished fight cannot end before it started");
  }
  const duration = Math.floor((input.finishedAt.getTime() - input.startedAt.getTime()) / 1000);
  const levelMin = Math.min(input.heroLevel, input.botLevel);
  const levelMax = Math.max(input.heroLevel, input.botLevel);
  return {
    id: parseDecimalId(input.fightId, "fight id"),
    accountId: input.accountId,
    heroId: input.heroId,
    title: huntFightTitle(input.heroNick, input.botNick),
    type: HUNT_FIGHT_TYPE,
    timeout: input.timeout,
    levelMin,
    levelMax,
    level: HUNT_HISTORY_LEVEL,
    mlTitle: `${input.botLevel}|${input.heroId}|${input.botId}`,
    winner: input.winner,
    started: fightStartedLabel(input.startedAt),
    duration,
    teams: huntFinishedFightTeams({
      heroId: input.heroId,
      heroNick: input.heroNick,
      heroLevel: input.heroLevel,
      heroKind: input.heroKind,
      heroDead: input.winner === 2,
      botId: input.botId,
      botNick: input.botNick,
      botLevel: input.botLevel,
    }),
    areaId: input.areaId,
    finishedAt: input.finishedAt,
  };
}

export function restoreFinishedFightRecord(row: {
  id: bigint;
  accountId: string;
  heroId: string;
  title: string;
  type: number;
  timeout: number;
  levelMin: number;
  levelMax: number;
  level: number;
  mlTitle: string;
  winner: number;
  started: string;
  duration: number;
  teams: unknown;
  areaId: string;
  finishedAt: Date;
}): FinishedFightRecord {
  if (row.winner !== 1 && row.winner !== 2) {
    throw new Error(`Finished fight ${row.id} has an invalid winner`);
  }
  if (!row.accountId) throw new Error(`Finished fight ${row.id} is missing account id`);
  if (!row.heroId) throw new Error(`Finished fight ${row.id} is missing hero id`);
  if (!row.title) throw new Error(`Finished fight ${row.id} is missing title`);
  if (!row.mlTitle) throw new Error(`Finished fight ${row.id} is missing ml_title`);
  if (!row.started) throw new Error(`Finished fight ${row.id} is missing started`);
  if (!row.areaId) throw new Error(`Finished fight ${row.id} is missing area id`);
  if (!Number.isInteger(row.type) || row.type < 1) {
    throw new Error(`Finished fight ${row.id} has an invalid type`);
  }
  if (!Number.isInteger(row.timeout) || row.timeout < 1) {
    throw new Error(`Finished fight ${row.id} has an invalid timeout`);
  }
  if (!Number.isInteger(row.levelMin) || row.levelMin < 1) {
    throw new Error(`Finished fight ${row.id} has an invalid level_min`);
  }
  if (!Number.isInteger(row.levelMax) || row.levelMax < row.levelMin) {
    throw new Error(`Finished fight ${row.id} has an invalid level_max`);
  }
  if (!Number.isInteger(row.level) || row.level < 0) {
    throw new Error(`Finished fight ${row.id} has an invalid level`);
  }
  if (!Number.isInteger(row.duration) || row.duration < 0) {
    throw new Error(`Finished fight ${row.id} has an invalid duration`);
  }
  return {
    id: row.id,
    accountId: row.accountId,
    heroId: row.heroId,
    title: row.title,
    type: row.type,
    timeout: row.timeout,
    levelMin: row.levelMin,
    levelMax: row.levelMax,
    level: row.level,
    mlTitle: row.mlTitle,
    winner: row.winner,
    started: row.started,
    duration: row.duration,
    teams: parseFinishedFightTeams(row.teams),
    areaId: row.areaId,
    finishedAt: row.finishedAt,
  };
}
