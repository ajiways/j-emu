const TEAMS_MAX_BYTES = 16_384;

type FinishedFightHuman = Readonly<{
  id: string;
  nick: string;
  level: number;
  kind: number;
  instance_id: 0;
  gag_time: 0;
  gag_reason: 0;
  clan_id: 0;
  injury_time: 0;
  injury_artikul_id: 0;
  server_id: 1;
  language: "ru";
  nick_color: 0;
  nick_color_expire: 0;
  punish: 0;
  dead: boolean;
  juggernaut: 0;
  flee: 0 | 1;
  bot: 0;
  me: 0;
}>;

type FinishedFightBot = Readonly<{
  bot: 1;
  artikul_id: string;
  id: string;
  nick: string;
  level: string;
  kind: string;
  me: 0;
}>;

export type FinishedFightTeams = Readonly<{
  "1": readonly FinishedFightHuman[];
  "2": readonly FinishedFightBot[];
}>;

export function huntFinishedFightTeams(input: {
  heroId: string;
  heroNick: string;
  heroLevel: number;
  heroKind: number;
  heroDead: boolean;
  botId: number;
  botNick: string;
  botLevel: number;
}): FinishedFightTeams {
  if (!input.heroId) throw new Error("Finished fight teams require a hero id");
  if (!input.heroNick) throw new Error("Finished fight teams require a hero nick");
  if (!Number.isInteger(input.heroLevel) || input.heroLevel < 1) {
    throw new Error("Finished fight teams require a positive hero level");
  }
  if (!Number.isInteger(input.heroKind) || input.heroKind < 1) {
    throw new Error("Finished fight teams require a positive hero kind");
  }
  if (!Number.isInteger(input.botId) || input.botId < 1) {
    throw new Error("Finished fight teams require a positive bot id");
  }
  if (!input.botNick) throw new Error("Finished fight teams require a bot nick");
  if (!Number.isInteger(input.botLevel) || input.botLevel < 1) {
    throw new Error("Finished fight teams require a positive bot level");
  }
  const teams: FinishedFightTeams = {
    "1": [
      {
        id: input.heroId,
        nick: input.heroNick,
        level: input.heroLevel,
        kind: input.heroKind,
        instance_id: 0,
        gag_time: 0,
        gag_reason: 0,
        clan_id: 0,
        injury_time: 0,
        injury_artikul_id: 0,
        server_id: 1,
        language: "ru",
        nick_color: 0,
        nick_color_expire: 0,
        punish: 0,
        dead: input.heroDead,
        juggernaut: 0,
        flee: 0,
        bot: 0,
        me: 0,
      },
    ],
    "2": [
      {
        bot: 1,
        artikul_id: String(input.botId),
        id: String(input.botId),
        nick: input.botNick,
        level: String(input.botLevel),
        kind: "0",
        me: 0,
      },
    ],
  };
  return parseFinishedFightTeams(teams);
}

export function parseFinishedFightTeams(value: unknown): FinishedFightTeams {
  const encoded = JSON.stringify(value);
  if (Buffer.byteLength(encoded, "utf8") > TEAMS_MAX_BYTES) {
    throw new Error("Finished fight teams exceed the storage size limit");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Finished fight teams must be an object");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 2 || !keys.includes("1") || !keys.includes("2")) {
    throw new Error("Finished fight teams must contain only teams 1 and 2");
  }
  const team1 = record["1"];
  const team2 = record["2"];
  if (!Array.isArray(team1) || team1.length !== 1) {
    throw new Error("Finished fight team 1 must contain exactly one human");
  }
  if (!Array.isArray(team2) || team2.length !== 1) {
    throw new Error("Finished fight team 2 must contain exactly one bot");
  }
  return {
    "1": [parseHuman(team1[0])],
    "2": [parseBot(team2[0])],
  };
}

function parseHuman(value: unknown): FinishedFightHuman {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Finished fight human member is invalid");
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id) throw new Error("Finished fight human id is required");
  if (typeof row.nick !== "string" || !row.nick) {
    throw new Error("Finished fight human nick is required");
  }
  if (!Number.isInteger(row.level) || (row.level as number) < 1) {
    throw new Error("Finished fight human level is invalid");
  }
  if (!Number.isInteger(row.kind) || (row.kind as number) < 1) {
    throw new Error("Finished fight human kind is invalid");
  }
  if (typeof row.dead !== "boolean") throw new Error("Finished fight human dead flag is invalid");
  assertZero(row, "instance_id");
  assertZero(row, "gag_time");
  assertZero(row, "gag_reason");
  assertZero(row, "clan_id");
  assertZero(row, "injury_time");
  assertZero(row, "injury_artikul_id");
  if (row.server_id !== 1) throw new Error("Finished fight human server_id is invalid");
  if (row.language !== "ru") throw new Error("Finished fight human language is invalid");
  assertZero(row, "nick_color");
  assertZero(row, "nick_color_expire");
  assertZero(row, "punish");
  assertZero(row, "juggernaut");
  if (row.flee !== 0 && row.flee !== 1) throw new Error("Finished fight human flee is invalid");
  if (row.bot !== 0) throw new Error("Finished fight human bot flag is invalid");
  if (row.me !== 0) throw new Error("Finished fight human me flag is invalid");
  return {
    id: row.id,
    nick: row.nick,
    level: row.level as number,
    kind: row.kind as number,
    instance_id: 0,
    gag_time: 0,
    gag_reason: 0,
    clan_id: 0,
    injury_time: 0,
    injury_artikul_id: 0,
    server_id: 1,
    language: "ru",
    nick_color: 0,
    nick_color_expire: 0,
    punish: 0,
    dead: row.dead,
    juggernaut: 0,
    flee: row.flee,
    bot: 0,
    me: 0,
  };
}

function parseBot(value: unknown): FinishedFightBot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Finished fight bot member is invalid");
  }
  const row = value as Record<string, unknown>;
  if (row.bot !== 1) throw new Error("Finished fight bot flag is invalid");
  if (typeof row.artikul_id !== "string" || !row.artikul_id) {
    throw new Error("Finished fight bot artikul_id is required");
  }
  if (typeof row.id !== "string" || !row.id) throw new Error("Finished fight bot id is required");
  if (typeof row.nick !== "string" || !row.nick) {
    throw new Error("Finished fight bot nick is required");
  }
  if (typeof row.level !== "string" || !row.level) {
    throw new Error("Finished fight bot level is required");
  }
  if (typeof row.kind !== "string") throw new Error("Finished fight bot kind is required");
  if (row.me !== 0) throw new Error("Finished fight bot me flag is invalid");
  return {
    bot: 1,
    artikul_id: row.artikul_id,
    id: row.id,
    nick: row.nick,
    level: row.level,
    kind: row.kind,
    me: 0,
  };
}

function assertZero(row: Record<string, unknown>, key: string): void {
  if (row[key] !== 0) throw new Error(`Finished fight human ${key} is invalid`);
}
