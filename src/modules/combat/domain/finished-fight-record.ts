import { parseDecimalId, requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { fightStartedLabel } from "./fight-started-label.ts";
import {
  huntFinishedFightTeams,
  parseFinishedFightTeams,
  type FinishedFightTeams,
} from "./finished-fight-teams.ts";
import { practiceFinishedFightTeams } from "./practice-finished-fight-teams.ts";
import { huntFightTitle } from "./hunt-fight-title.ts";

/** Hunt / BG PvP `fight.type` from live fight_info dump `type:"1"`. */
const HUNT_FIGHT_TYPE = 1;

/** Practice duel `fight.type` from old `FRIENDS_DUEL_TYPE`. */
const PRACTICE_FIGHT_TYPE = 6;

/** Old `recordFinishedFight` always stored `level: 0`. */
const HUNT_HISTORY_LEVEL = 0;

export type FinishedFightRecord = Readonly<{
  id: bigint;
  accountId: number;
  heroId: number;
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
  accountId: number;
  heroId: number;
  heroNick: string;
  heroLevel: number;
  heroKind: number;
  botArtikulId: number;
  botNick: string;
  botLevel: number;
  timeout: number;
  areaId: string;
  winner: 1 | 2;
  startedAt: Date;
  finishedAt: Date;
}): FinishedFightRecord {
  requireWireIdentity(input.accountId, "account id");
  requireWireIdentity(input.heroId, "hero id");
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
  requireWireIdentity(input.botArtikulId, "bot artikul id");
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
    mlTitle: `${input.botLevel}|${input.heroId}|${input.botArtikulId}`,
    winner: input.winner,
    started: fightStartedLabel(input.startedAt),
    duration,
    teams: huntFinishedFightTeams({
      heroId: input.heroId,
      heroNick: input.heroNick,
      heroLevel: input.heroLevel,
      heroKind: input.heroKind,
      heroDead: input.winner === 2,
      botArtikulId: input.botArtikulId,
      botNick: input.botNick,
      botLevel: input.botLevel,
    }),
    areaId: input.areaId,
    finishedAt: input.finishedAt,
  };
}

export function practiceFinishedFightRecord(input: {
  fightId: string;
  accountId: number;
  heroId: number;
  challengerId: number;
  challengerNick: string;
  challengerLevel: number;
  challengerKind: number;
  challengerDead: boolean;
  challengerFlee: 0 | 1;
  acceptorId: number;
  acceptorNick: string;
  acceptorLevel: number;
  acceptorKind: number;
  acceptorDead: boolean;
  acceptorFlee: 0 | 1;
  timeout: number;
  areaId: string;
  winner: 1 | 2;
  startedAt: Date;
  finishedAt: Date;
}): FinishedFightRecord {
  requireWireIdentity(input.accountId, "account id");
  requireWireIdentity(input.heroId, "hero id");
  if (!input.areaId) throw new Error("Finished fight requires an area id");
  if (!Number.isInteger(input.timeout) || input.timeout < 1) {
    throw new Error("Finished fight timeout must be a positive integer");
  }
  if (input.finishedAt.getTime() < input.startedAt.getTime()) {
    throw new Error("Finished fight cannot end before it started");
  }
  const duration = Math.floor((input.finishedAt.getTime() - input.startedAt.getTime()) / 1000);
  const levelMin = Math.min(input.challengerLevel, input.acceptorLevel);
  const levelMax = Math.max(input.challengerLevel, input.acceptorLevel);
  return {
    id: parseDecimalId(input.fightId, "fight id"),
    accountId: input.accountId,
    heroId: input.heroId,
    title: huntFightTitle(input.challengerNick, input.acceptorNick),
    type: PRACTICE_FIGHT_TYPE,
    timeout: input.timeout,
    levelMin,
    levelMax,
    level: HUNT_HISTORY_LEVEL,
    mlTitle: `${input.challengerLevel}|${input.heroId}|${input.challengerLevel}`,
    winner: input.winner,
    started: fightStartedLabel(input.startedAt),
    duration,
    teams: practiceFinishedFightTeams({
      challengerId: input.challengerId,
      challengerNick: input.challengerNick,
      challengerLevel: input.challengerLevel,
      challengerKind: input.challengerKind,
      challengerDead: input.challengerDead,
      challengerFlee: input.challengerFlee,
      acceptorId: input.acceptorId,
      acceptorNick: input.acceptorNick,
      acceptorLevel: input.acceptorLevel,
      acceptorKind: input.acceptorKind,
      acceptorDead: input.acceptorDead,
      acceptorFlee: input.acceptorFlee,
    }),
    areaId: input.areaId,
    finishedAt: input.finishedAt,
  };
}

export function restoreFinishedFightRecord(row: {
  id: bigint;
  accountId: number;
  heroId: number;
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
  requireWireIdentity(row.accountId, "account id");
  requireWireIdentity(row.heroId, "hero id");
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

export function finishedFightOutcomesEqual(
  left: FinishedFightRecord,
  right: FinishedFightRecord,
): boolean {
  return (
    left.id === right.id &&
    left.accountId === right.accountId &&
    left.heroId === right.heroId &&
    left.title === right.title &&
    left.type === right.type &&
    left.timeout === right.timeout &&
    left.levelMin === right.levelMin &&
    left.levelMax === right.levelMax &&
    left.level === right.level &&
    left.mlTitle === right.mlTitle &&
    left.winner === right.winner &&
    left.areaId === right.areaId &&
    JSON.stringify(left.teams) === JSON.stringify(right.teams)
  );
}
