import type { BattlegroundDocument } from "../../content/domain/content-battleground.ts";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import {
  battlegroundLeaderGroups,
  battlegroundRooms,
  battlegrounds,
} from "./schema-battlegrounds.ts";

export async function insertBattlegrounds(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly BattlegroundDocument[],
): Promise<void> {
  if (rows.length === 0) throw new Error("Battleground catalog documents are required");
  await session.insert(battlegrounds).values(
    rows.map((row) => ({
      releaseId,
      type: row.type,
      id: row.id,
      title: row.title,
      flags: row.flags,
      available: row.available,
      queueLevel: row.queueLevel,
      error: row.error,
      playable: row.playable,
      instArtikulId: row.instArtikulId,
      levelMin: row.levelMin,
      levelMax: row.levelMax,
      returnAreaId: row.returnAreaId,
      westAreaId: row.westAreaId,
      arenaAreaId: row.arenaAreaId,
      eastAreaId: row.eastAreaId,
      inviteTtlSec: row.inviteTtlSec,
      banSec: row.banSec,
      matchDurationSec: row.matchDurationSec,
      maxScore: row.maxScore,
      pointsPerKill: row.pointsPerKill,
      fightBg: row.fightBg,
      fightFlags: row.fightFlags,
      mapPicture: row.mapPicture,
      statsPicture: row.statsPicture,
      description: row.description,
      rules: row.rules,
    })),
  );
  const rooms = rows.flatMap((row) =>
    row.roomPos.map((room) => ({
      releaseId,
      type: row.type,
      id: row.id,
      areaId: room.areaId,
      x: room.x,
      y: room.y,
      title: room.title,
    })),
  );
  if (rooms.length > 0) await session.insert(battlegroundRooms).values(rooms);
  const groups = rows.flatMap((row) =>
    row.leaderGroups.map((group) => ({
      releaseId,
      type: row.type,
      id: row.id,
      groupId: group.id,
      minLevel: group.minLevel,
      maxLevel: group.maxLevel,
    })),
  );
  if (groups.length > 0) await session.insert(battlegroundLeaderGroups).values(groups);
}
