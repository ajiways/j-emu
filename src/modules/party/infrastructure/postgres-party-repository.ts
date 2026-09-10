import { and, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { PartyDeniedError } from "../domain/party-denied-error.ts";
import type {
  NewParty,
  PartyInviteRow,
  PartyMemberRow,
  PartyMembership,
  PartyRecord,
} from "../domain/party-record.ts";
import type { PartyRepository } from "../ports/party-repository.ts";
import { parties, partyInvites, partyMembers } from "./schema.ts";

export class PostgresPartyRepository implements PartyRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async insertParty(row: NewParty): Promise<PartyRecord> {
    const inserted = await this.database.session().insert(parties).values(row).returning();
    const created = inserted[0];
    if (inserted.length !== 1 || !created) throw new Error("Party insert did not return an id");
    return toParty(created);
  }

  async lockParty(partyId: number): Promise<PartyRecord | null> {
    requireWireIdentity(partyId, "party id");
    const rows = await this.database
      .session()
      .select()
      .from(parties)
      .where(eq(parties.id, partyId))
      .for("update")
      .limit(1);
    const row = rows[0];
    return row ? toParty(row) : null;
  }

  async getParty(partyId: number): Promise<PartyRecord | null> {
    requireWireIdentity(partyId, "party id");
    const rows = await this.database
      .session()
      .select()
      .from(parties)
      .where(eq(parties.id, partyId))
      .limit(1);
    const row = rows[0];
    return row ? toParty(row) : null;
  }

  async saveParty(party: PartyRecord): Promise<void> {
    const updated = await this.database
      .session()
      .update(parties)
      .set({
        leaderHeroId: party.leaderHeroId,
        lootRules: party.lootRules,
        noChat: party.noChat,
        flags: party.flags,
        isSearch: party.isSearch,
        password: party.password,
        instanceArtikulId: party.instanceArtikulId,
        botArtikulId: party.botArtikulId,
        type: party.type,
        distributeReadyAt: party.distributeReadyAt,
      })
      .where(eq(parties.id, party.id))
      .returning({ id: parties.id });
    if (updated.length !== 1) throw new Error(`Party ${party.id} update missed the row`);
  }

  async deleteParty(partyId: number): Promise<void> {
    requireWireIdentity(partyId, "party id");
    const deleted = await this.database
      .session()
      .delete(parties)
      .where(eq(parties.id, partyId))
      .returning({ id: parties.id });
    if (deleted.length !== 1) throw new Error(`Party ${partyId} delete missed the row`);
  }

  async insertMember(row: PartyMemberRow): Promise<void> {
    try {
      await this.database.session().insert(partyMembers).values(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new PartyDeniedError("Вы уже находитесь в группе!");
      }
      throw error;
    }
  }

  async membershipByHero(heroId: number): Promise<PartyMembership | null> {
    requireWireIdentity(heroId, "hero id");
    const rows = await this.database
      .session()
      .select({ party: parties, member: partyMembers })
      .from(partyMembers)
      .innerJoin(parties, eq(parties.id, partyMembers.partyId))
      .where(eq(partyMembers.heroId, heroId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return { party: toParty(row.party), member: toMember(row.member) };
  }

  async listMembers(partyId: number): Promise<readonly PartyMemberRow[]> {
    requireWireIdentity(partyId, "party id");
    const rows = await this.database
      .session()
      .select()
      .from(partyMembers)
      .where(eq(partyMembers.partyId, partyId));
    return rows.map(toMember);
  }

  async deleteMember(partyId: number, heroId: number): Promise<void> {
    requireWireIdentity(partyId, "party id");
    requireWireIdentity(heroId, "hero id");
    const deleted = await this.database
      .session()
      .delete(partyMembers)
      .where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.heroId, heroId)))
      .returning({ heroId: partyMembers.heroId });
    if (deleted.length !== 1) {
      throw new Error(`Party ${partyId} member ${heroId} delete missed the row`);
    }
  }

  async deleteMembers(partyId: number): Promise<void> {
    requireWireIdentity(partyId, "party id");
    await this.database.session().delete(partyMembers).where(eq(partyMembers.partyId, partyId));
  }

  async replaceInvite(row: PartyInviteRow): Promise<void> {
    await this.database
      .session()
      .delete(partyInvites)
      .where(
        and(eq(partyInvites.partyId, row.partyId), eq(partyInvites.targetHeroId, row.targetHeroId)),
      );
    await this.database.session().insert(partyInvites).values(row);
  }

  async findInvite(partyId: number, targetHeroId: number): Promise<PartyInviteRow | null> {
    requireWireIdentity(partyId, "party id");
    requireWireIdentity(targetHeroId, "hero id");
    const rows = await this.database
      .session()
      .select()
      .from(partyInvites)
      .where(and(eq(partyInvites.partyId, partyId), eq(partyInvites.targetHeroId, targetHeroId)))
      .limit(1);
    const row = rows[0];
    return row ? toInvite(row) : null;
  }

  async deleteInvite(partyId: number, targetHeroId: number): Promise<void> {
    requireWireIdentity(partyId, "party id");
    requireWireIdentity(targetHeroId, "hero id");
    await this.database
      .session()
      .delete(partyInvites)
      .where(and(eq(partyInvites.partyId, partyId), eq(partyInvites.targetHeroId, targetHeroId)));
  }

  async deleteInvites(partyId: number): Promise<void> {
    requireWireIdentity(partyId, "party id");
    await this.database.session().delete(partyInvites).where(eq(partyInvites.partyId, partyId));
  }

  async listSearchable(): Promise<readonly PartyRecord[]> {
    const rows = await this.database
      .session()
      .select()
      .from(parties)
      .where(eq(parties.isSearch, 1));
    return rows.map(toParty);
  }
}

function toParty(row: typeof parties.$inferSelect): PartyRecord {
  return {
    id: row.id,
    leaderHeroId: row.leaderHeroId,
    lootRules: row.lootRules,
    noChat: row.noChat,
    flags: row.flags,
    isSearch: row.isSearch,
    password: row.password,
    instanceArtikulId: row.instanceArtikulId,
    botArtikulId: row.botArtikulId,
    type: row.type,
    distributeReadyAt: row.distributeReadyAt,
    createdAt: row.createdAt,
  };
}

function toMember(row: typeof partyMembers.$inferSelect): PartyMemberRow {
  return {
    partyId: row.partyId,
    heroId: row.heroId,
    accountId: row.accountId,
    joinedAt: row.joinedAt,
  };
}

function toInvite(row: typeof partyInvites.$inferSelect): PartyInviteRow {
  return {
    partyId: row.partyId,
    targetHeroId: row.targetHeroId,
    fromHeroId: row.fromHeroId,
    createdAt: row.createdAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "23505") return true;
  if ("cause" in error) return isUniqueViolation(error.cause);
  return false;
}
