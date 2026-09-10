import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { HISTORY_PAGE_SIZE } from "../domain/battleground-definition.ts";
import type {
  BattlegroundHistory,
  FinishedBattlegroundMatch,
  FinishedBattlegroundPage,
  FinishedBattlegroundPlayer,
} from "../ports/battleground-history.ts";
import { finishedMatches, finishedPlayers } from "./schema.ts";

export class PostgresBattlegroundHistory implements BattlegroundHistory {
  constructor(private readonly database: PostgresDatabase) {}

  async record(match: FinishedBattlegroundMatch): Promise<void> {
    if (match.players.length < 1) throw new Error("Finished battleground players are required");
    await this.database.session().transaction(async (tx) => {
      const inserted = await tx
        .insert(finishedMatches)
        .values({
          copyId: match.copyId,
          bgId: match.bgId,
          bgType: match.bgType,
          instArtikulId: match.instArtikulId,
          title: match.title,
          timeStart: match.timeStart,
          timeFinish: match.timeFinish,
          levelMin: match.levelMin,
          levelMax: match.levelMax,
          maxScore: match.maxScore,
          scoreLeague: match.scoreLeague,
          scoreCohort: match.scoreCohort,
          winnerKind: match.winnerKind ?? 0,
        })
        .returning({ id: finishedMatches.id });
      const row = inserted[0];
      if (!row)
        throw new Error(`Battleground history insert for copy ${match.copyId} returned no row`);
      await tx.insert(finishedPlayers).values(
        match.players.map((player) => ({
          matchId: row.id,
          heroId: player.heroId,
          nick: player.nick,
          level: player.level,
          kind: player.kind,
          dmg: player.dmg,
          exp: player.exp,
          honor: player.honor,
          honorBonus: player.honorBonus,
          killCnt: player.killCnt,
          deathCnt: player.deathCnt,
          fatalityCnt: player.fatalityCnt,
          rank: player.rank,
          returnAreaId: player.returnAreaId,
        })),
      );
    });
  }

  async list(
    input: Readonly<{
      bgId: string;
      page: number;
      search: string;
    }>,
  ): Promise<FinishedBattlegroundPage> {
    if (!input.bgId) throw new Error("Battleground history bg id is required");
    if (!Number.isInteger(input.page) || input.page < 1) {
      throw new Error("Battleground history page must be a positive integer");
    }
    const session = this.database.session();
    const search = input.search.trim();
    const nickFilter = search
      ? inArray(
          finishedMatches.id,
          session
            .select({ id: finishedPlayers.matchId })
            .from(finishedPlayers)
            .where(ilike(finishedPlayers.nick, `%${escapeLike(search)}%`)),
        )
      : undefined;
    const where = nickFilter
      ? and(eq(finishedMatches.bgId, input.bgId), nickFilter)
      : eq(finishedMatches.bgId, input.bgId);
    const [countRow] = await session
      .select({ n: sql<number>`count(*)::int` })
      .from(finishedMatches)
      .where(where);
    const total = countRow?.n;
    if (total === undefined) throw new Error("Battleground history count is missing");
    const pages = total === 0 ? 0 : Math.ceil(total / HISTORY_PAGE_SIZE);
    const rows = await session
      .select()
      .from(finishedMatches)
      .where(where)
      .orderBy(desc(finishedMatches.timeFinish), desc(finishedMatches.id))
      .limit(HISTORY_PAGE_SIZE)
      .offset((input.page - 1) * HISTORY_PAGE_SIZE);
    const matches: FinishedBattlegroundMatch[] = [];
    for (const row of rows) {
      const players = await session
        .select()
        .from(finishedPlayers)
        .where(eq(finishedPlayers.matchId, row.id));
      matches.push({
        copyId: row.copyId,
        bgId: row.bgId,
        bgType: row.bgType,
        instArtikulId: row.instArtikulId,
        title: row.title,
        timeStart: row.timeStart,
        timeFinish: row.timeFinish,
        levelMin: row.levelMin,
        levelMax: row.levelMax,
        maxScore: row.maxScore,
        scoreLeague: row.scoreLeague,
        scoreCohort: row.scoreCohort,
        winnerKind: row.winnerKind === 0 ? null : row.winnerKind,
        players: players.map(playerFromRow),
      });
    }
    return { matches, page: input.page, pages, search };
  }
}

function playerFromRow(row: typeof finishedPlayers.$inferSelect): FinishedBattlegroundPlayer {
  return {
    heroId: row.heroId,
    nick: row.nick,
    level: row.level,
    kind: row.kind,
    returnAreaId: row.returnAreaId,
    dmg: row.dmg,
    exp: row.exp,
    honor: row.honor,
    honorBonus: row.honorBonus,
    killCnt: row.killCnt,
    deathCnt: row.deathCnt,
    fatalityCnt: row.fatalityCnt,
    rank: row.rank,
  };
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
