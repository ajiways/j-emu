import { requireSafeWireInteger } from "../../../shared/kernel/decimal-id.ts";
import type { FinishedFightRecord } from "../domain/finished-fight-record.ts";
import type { FinishedFightTeams } from "../domain/finished-fight-teams.ts";

export type ArenaFinishedFightRow = Readonly<{
  id: number;
  title: string;
  type: number;
  timeout: number;
  level_min: number;
  level_max: number;
  level: number;
  ml_title: string;
  winner: string;
  started: string;
  duration: string;
  teams: FinishedFightTeams;
}>;

export type FinishedFightInfoView = Readonly<{
  status: 100;
  fight: Readonly<{
    id: string;
    title: string;
    type: string;
    type_title: string;
    started: string;
    finished: 1;
    duration: string;
    area: string;
    timeout: number;
  }>;
  users: Readonly<
    Record<
      string,
      Readonly<{
        id: string;
        bot: boolean;
        artikul_id: number;
        team: number;
        nick: string;
        nick_info: "";
        money: "0.00";
        level: number;
        kind: number;
        flee: boolean;
        loot: 0;
        injury: 0;
        kill_count: 0;
        exp: 0;
        honor: 0;
        dmg: "";
        heal: 0;
        dead: boolean;
        offline: 0 | 1;
        hp: 0;
        mp: 0;
        hpMax: 0;
        mpMax: 0;
      }>
    >
  >;
  winner_team: string;
  macroses: Readonly<Record<string, never>>;
  share: "";
}>;

export function toArenaFinishedFightRow(row: FinishedFightRecord): ArenaFinishedFightRow {
  return {
    id: requireSafeWireInteger(row.id, "fight id"),
    title: row.title,
    type: row.type,
    timeout: row.timeout,
    level_min: row.levelMin,
    level_max: row.levelMax,
    level: row.level,
    ml_title: row.mlTitle,
    winner: String(row.winner),
    started: row.started,
    duration: String(row.duration),
    teams: row.teams,
  };
}

export function toFinishedFightInfoView(row: FinishedFightRecord): FinishedFightInfoView {
  const users: {
    [key: string]: FinishedFightInfoView["users"][string];
  } = {};
  let uid = 1;
  for (const member of row.teams["1"]) {
    users[String(uid)] = infoUser({
      id: member.id,
      bot: false,
      artikulId: 0,
      team: 1,
      nick: member.nick,
      level: member.level,
      kind: member.kind,
      flee: member.flee === 1,
      dead: member.dead,
    });
    uid += 1;
  }
  for (const member of row.teams["2"]) {
    users[String(uid)] = infoUser({
      id: member.id,
      bot: true,
      artikulId: Number(member.artikul_id),
      team: 2,
      nick: member.nick,
      level: Number(member.level),
      kind: Number(member.kind),
      flee: false,
      dead: row.winner === 1,
    });
    uid += 1;
  }
  return {
    status: 100,
    fight: {
      id: row.id.toString(),
      title: row.title,
      type: String(row.type),
      type_title: "бой",
      started: row.started,
      finished: 1,
      duration: `${row.duration}&nbsp;с.`,
      area: "—",
      timeout: row.timeout,
    },
    users,
    winner_team: String(row.winner),
    macroses: {},
    share: "",
  };
}

function infoUser(input: {
  id: string;
  bot: boolean;
  artikulId: number;
  team: number;
  nick: string;
  level: number;
  kind: number;
  flee: boolean;
  dead: boolean;
}): FinishedFightInfoView["users"][string] {
  return {
    id: input.id,
    bot: input.bot,
    artikul_id: input.artikulId,
    team: input.team,
    nick: input.nick,
    nick_info: "",
    money: "0.00",
    level: input.level,
    kind: input.kind,
    flee: input.flee,
    loot: 0,
    injury: 0,
    kill_count: 0,
    exp: 0,
    honor: 0,
    dmg: "",
    heal: 0,
    dead: input.dead,
    offline: input.bot ? 0 : 1,
    hp: 0,
    mp: 0,
    hpMax: 0,
    mpMax: 0,
  };
}
