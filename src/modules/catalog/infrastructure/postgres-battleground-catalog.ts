import { and, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { ActiveContentRevision } from "../../content/ports/active-content-revision.ts";
import type {
  BattlegroundDefinition,
  BattlegroundLeaderGroup,
  BattlegroundRoomPos,
} from "../../battleground/domain/battleground-definition.ts";
import type { BattlegroundCatalog } from "../../battleground/ports/battleground-catalog.ts";
import {
  battlegroundLeaderGroups,
  battlegroundRooms,
  battlegrounds,
} from "./schema-battlegrounds.ts";

export class PostgresBattlegroundCatalog implements BattlegroundCatalog {
  constructor(
    private readonly database: PostgresDatabase,
    private readonly revision: ActiveContentRevision,
  ) {}

  async list(): Promise<readonly BattlegroundDefinition[]> {
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(battlegrounds)
      .where(eq(battlegrounds.releaseId, releaseId));
    if (rows.length < 1) throw new Error("Battleground catalog is empty");
    return Promise.all(rows.map((row) => this.hydrate(releaseId, row)));
  }

  async byKey(type: string, id: number): Promise<BattlegroundDefinition | null> {
    if (!type) throw new Error("Battleground type is required");
    if (!Number.isInteger(id) || id < 1) throw new Error("Battleground id is required");
    const releaseId = await this.revision.requireId();
    const rows = await this.database
      .session()
      .select()
      .from(battlegrounds)
      .where(
        and(
          eq(battlegrounds.releaseId, releaseId),
          eq(battlegrounds.type, type),
          eq(battlegrounds.id, id),
        ),
      );
    if (rows.length > 1) throw new Error(`Multiple battlegrounds found for ${type}|${id}`);
    const row = rows[0];
    if (!row) return null;
    return this.hydrate(releaseId, row);
  }

  async playable(): Promise<BattlegroundDefinition> {
    const cards = (await this.list()).filter((card) => card.playable);
    if (cards.length !== 1) {
      throw new Error(`Expected one playable battleground, found ${cards.length}`);
    }
    const card = cards[0];
    if (!card) throw new Error("Playable battleground is missing");
    return card;
  }

  private async hydrate(
    releaseId: string,
    row: typeof battlegrounds.$inferSelect,
  ): Promise<BattlegroundDefinition> {
    const rooms = await this.database
      .session()
      .select()
      .from(battlegroundRooms)
      .where(
        and(
          eq(battlegroundRooms.releaseId, releaseId),
          eq(battlegroundRooms.type, row.type),
          eq(battlegroundRooms.id, row.id),
        ),
      );
    const groups = await this.database
      .session()
      .select()
      .from(battlegroundLeaderGroups)
      .where(
        and(
          eq(battlegroundLeaderGroups.releaseId, releaseId),
          eq(battlegroundLeaderGroups.type, row.type),
          eq(battlegroundLeaderGroups.id, row.id),
        ),
      );
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      flags: row.flags,
      available: row.available === 1 ? 1 : 0,
      queueLevel: row.queueLevel,
      error: row.error,
      playable: row.playable === 1,
      instArtikulId: String(row.instArtikulId),
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
      roomPos: rooms.map((room): BattlegroundRoomPos => ({
        areaId: room.areaId,
        x: room.x,
        y: room.y,
        title: room.title,
      })),
      leaderGroups: groups.map((group): BattlegroundLeaderGroup => ({
        id: group.groupId,
        minLevel: group.minLevel,
        maxLevel: group.maxLevel,
      })),
    };
  }
}
