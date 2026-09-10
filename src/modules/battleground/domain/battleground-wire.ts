import {
  KIND_COHORT,
  KIND_LEAGUE,
  type BattlegroundDefinition,
} from "../domain/battleground-definition.ts";
import type { LiveBattlegroundMatch, MatchPlayer } from "../application/battleground-matches.ts";
import type { FinishedBattlegroundMatch } from "../ports/battleground-history.ts";

export function listRow(
  card: BattlegroundDefinition,
  overlay: Readonly<{
    requestCount: number;
    userInQueue: 0 | 1;
    bgCount: number;
    penaltyTime: number;
    hasAnyRequest: 0 | 1;
  }>,
): Readonly<Record<string, unknown>> {
  const row: Record<string, unknown> = {
    id: card.id,
    type: card.type,
    flags: card.flags,
    queue_level: card.queueLevel,
    available: card.available,
    request_count: card.playable ? overlay.requestCount : 0,
    user_in_queue: card.playable ? overlay.userInQueue : 0,
    bg_count: card.playable ? overlay.bgCount : 0,
    penalty_time: overlay.penaltyTime,
    has_any_request: overlay.hasAnyRequest,
  };
  if (card.error) row.error = card.error;
  return row;
}

export function inviteWindow(
  definition: BattlegroundDefinition,
  hideUnix: number,
): Readonly<Record<string, unknown>> {
  return {
    title: "Приглашение на поле битвы",
    text: `Подошла ваша очередь сразиться на поле битвы <strong>${definition.title}</strong>.`,
    image: "images/invite_group.jpg",
    show_ttl: String(definition.inviteTtlSec),
    hide_time: hideUnix,
    timer_text: "Ваша заявка действительна:",
    disable_user_actions: 1,
    buttons: [
      {
        caption: "Согласиться",
        action: {
          object: "arena",
          action: "bg_request",
          form: { id: String(definition.id), status: "confirm" },
        },
      },
      {
        caption: "Отказаться",
        action: {
          object: "arena",
          action: "bg_request",
          form: { id: String(definition.id), status: "delete" },
        },
      },
    ],
  };
}

export function instanceMapConf(
  input: Readonly<{
    definition: BattlegroundDefinition;
    nick: string;
    viewerAreaId: string;
    viewerKind: number;
    users: readonly MatchPlayer[];
    areasByHero: ReadonlyMap<number, string>;
  }>,
): Readonly<Record<string, unknown>> {
  const hrefs = roomHrefs(input.definition, input.viewerAreaId, input.viewerKind);
  return {
    status: 100,
    nick: input.nick,
    picture: input.definition.mapPicture,
    rooms: input.definition.roomPos.map((room) => ({
      id: Number(room.areaId),
      title: room.title,
      x: room.x,
      y: room.y,
      href: requireHref(hrefs, room.areaId),
    })),
    users: input.users
      .filter((user) => user.kind === input.viewerKind)
      .map((user) => ({
        id: user.heroId,
        nick: user.nick,
        level: user.level,
        kind: user.kind,
        area_id: Number(requireArea(input.areasByHero, user.heroId)),
      })),
    objects: emptyObjects(input.definition),
  };
}

export function bgStatsPayload(
  input: Readonly<{
    match: LiveBattlegroundMatch;
    viewer: MatchPlayer;
    finished: boolean;
    areasByHero?: ReadonlyMap<number, string>;
  }>,
): Readonly<Record<string, unknown>> {
  const shareKey = `bg${input.match.copyId}`;
  const payload: Record<string, unknown> = {
    status: 100,
    title: input.match.definition.title,
    description: input.match.definition.description,
    rules: input.match.definition.rules,
    picture: input.match.definition.statsPicture,
    max_score: String(input.match.definition.maxScore),
    score: { "2": input.match.scoreLeague, "3": input.match.scoreCohort },
    instance_id: String(input.match.copyId),
    time_start: input.match.timeStart,
    time_finish: String(input.match.timeFinish),
    finished: input.finished ? 1 : 0,
    team: String(input.viewer.kind),
    user_stats: userStatsMap([...input.match.players.values()], {
      finish: input.finished,
      ...(input.finished ? {} : { hideEnemyNickFor: input.viewer.heroId }),
    }),
    macroses: {
      [shareKey]: {
        image: "https://s1.jugger.ru/images/data/soc_img/alt_bg_aridanshahta.jpg",
        key_id: shareKey,
        link: `https://s1.jugger.ru/bg_info.php?instance_id=${input.match.copyId}`,
        link_title: "https://s1.jugger.ru/",
        macro_type: "SHARE",
        text: "На Поле битв кровь лилась рекой! Враги надолго запомнят мой натиск!",
        title: "бг_инфо",
      },
    },
    share: `[[SHARE ${shareKey}]]`,
  };
  if (input.finished && input.match.winnerKind) payload.winner = input.match.winnerKind;
  return payload;
}

export function finishedHistoryWire(
  match: FinishedBattlegroundMatch,
): Readonly<Record<string, unknown>> {
  return {
    title: match.title,
    inst_artikul_id: Number(match.instArtikulId),
    max_score: match.maxScore,
    bg_id: match.bgId,
    time_start: match.timeStart,
    time_finish: match.timeFinish,
    instance_id: String(match.copyId),
    level_min: String(match.levelMin),
    level_max: String(match.levelMax),
    teams: {
      "2": {
        score: match.scoreLeague,
        users: match.players.filter((player) => player.kind === KIND_LEAGUE).map(historyUser),
      },
      "3": {
        score: match.scoreCohort,
        users: match.players.filter((player) => player.kind === KIND_COHORT).map(historyUser),
      },
    },
  };
}

export function leaderRatingWire(
  groups: BattlegroundDefinition["leaderGroups"],
): Readonly<Record<string, unknown>> {
  const level_groups: Record<string, { id: string; min_level: string; max_level: string }> = {};
  for (const group of groups) {
    level_groups[group.id] = {
      id: group.id,
      min_level: group.minLevel,
      max_level: group.maxLevel,
    };
  }
  return { status: 100, level_groups, rating: {} };
}

function historyUser(player: FinishedBattlegroundMatch["players"][number]) {
  return {
    user_id: player.heroId,
    nick: player.nick,
    level: player.level,
    kind: player.kind,
    dmg: player.dmg,
    heal: 0,
    exp: player.exp,
    honor: player.honor,
    kill_cnt: player.killCnt,
    death_cnt: player.deathCnt,
    team: player.kind,
    rank: player.rank,
  };
}

function userStatsMap(
  players: readonly MatchPlayer[],
  opts: Readonly<{ hideEnemyNickFor?: number; finish: boolean }>,
): Readonly<Record<string, Record<string, unknown>>> {
  const teams: Record<string, Record<string, unknown>> = { "2": {}, "3": {} };
  let anon = 1;
  for (const player of players) {
    const teamKey = String(player.kind === KIND_COHORT ? KIND_COHORT : KIND_LEAGUE);
    const rowId = String(29_400_000 + player.heroId);
    let nick = player.nick;
    if (!opts.finish && opts.hideEnemyNickFor && player.heroId !== opts.hideEnemyNickFor) {
      nick = `Игрок ${anon}`;
      anon += 1;
    }
    const bucket = teams[teamKey];
    if (!bucket) throw new Error(`Battleground team ${teamKey} is missing`);
    bucket[rowId] = {
      death_cnt: player.deathCnt,
      dmg: player.dmg,
      exp: player.exp,
      fatality_cnt: player.fatalityCnt,
      honor: player.honor,
      honor_bonus: player.honorBonus,
      id: Number(rowId),
      kill_cnt: player.killCnt,
      kind: String(player.kind),
      level: String(player.level),
      nick,
      original_nick: player.nick,
      rank: player.rank,
      team: player.kind,
    };
  }
  return teams;
}

function roomHrefs(
  definition: BattlegroundDefinition,
  viewerAreaId: string,
  viewerKind: number,
): Map<string, unknown> {
  const empty: unknown[] = [];
  const comeIn = (areaId: string) => ({
    object: "common",
    action: "action",
    form: { code: "COME_IN", area_id: Number(areaId) },
  });
  const out = new Map<string, unknown>([
    [definition.westAreaId, empty],
    [definition.arenaAreaId, empty],
    [definition.eastAreaId, empty],
  ]);
  if (viewerAreaId === definition.arenaAreaId) {
    out.set(definition.westAreaId, comeIn(definition.westAreaId));
    out.set(definition.eastAreaId, comeIn(definition.eastAreaId));
    return out;
  }
  if (viewerAreaId === definition.westAreaId || viewerAreaId === definition.eastAreaId) {
    out.set(definition.arenaAreaId, comeIn(definition.arenaAreaId));
    return out;
  }
  void viewerKind;
  return out;
}

function emptyObjects(
  definition: BattlegroundDefinition,
): Readonly<Record<string, Record<string, string>>> {
  const slots: Record<string, string> = {};
  for (let i = 1; i <= 10; i += 1) slots[String(i)] = "";
  return {
    [definition.westAreaId]: { ...slots },
    [definition.arenaAreaId]: { ...slots },
    [definition.eastAreaId]: { ...slots },
  };
}

function requireHref(hrefs: Map<string, unknown>, areaId: string): unknown {
  if (!hrefs.has(areaId)) throw new Error(`Battleground room href for ${areaId} is missing`);
  return hrefs.get(areaId);
}

function requireArea(areasByHero: ReadonlyMap<number, string>, heroId: number): string {
  const areaId = areasByHero.get(heroId);
  if (!areaId) throw new Error(`Battleground hero ${heroId} area is missing`);
  return areaId;
}
