import { and, desc, eq, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { Letter, NewLetter } from "../domain/letter.ts";
import { MAIL_FOLDER_INBOX, type MailFolder } from "../domain/mail-folder.ts";
import { MAIL_FLAG_READ } from "../domain/mail-flags.ts";
import type { LetterRepository } from "../ports/letter-repository.ts";
import { letters } from "./schema.ts";

export class PostgresLetterRepository implements LetterRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async insert(row: NewLetter): Promise<Letter> {
    const inserted = await this.database
      .session()
      .insert(letters)
      .values({
        ownerHeroId: row.ownerHeroId,
        folder: row.folder,
        peerHeroId: row.peerHeroId,
        peerNick: row.peerNick,
        subject: row.subject,
        body: row.body,
        sentAt: row.sentAt,
        expiresAt: row.expiresAt,
        flags: row.flags,
        moneyComeMinor: BigInt(row.moneyComeMinor),
        paymentMinor: BigInt(row.paymentMinor),
        taxMinor: BigInt(row.taxMinor),
        moneyType: row.moneyType,
        pairId: row.pairId,
        system: row.system,
      })
      .returning();
    const created = inserted[0];
    if (inserted.length !== 1 || !created) throw new Error("Mail insert did not return an id");
    return toLetter(created);
  }

  async setPairId(id: number, pairId: number): Promise<void> {
    requireWireIdentity(id, "letter id");
    requireWireIdentity(pairId, "pair id");
    const updated = await this.database
      .session()
      .update(letters)
      .set({ pairId })
      .where(eq(letters.id, id))
      .returning({ id: letters.id });
    if (updated.length !== 1) throw new Error(`Letter ${id} pair_id update missed the row`);
  }

  async listFolder(ownerHeroId: number, folder: MailFolder): Promise<readonly Letter[]> {
    requireWireIdentity(ownerHeroId, "hero id");
    const rows = await this.database
      .session()
      .select()
      .from(letters)
      .where(and(eq(letters.ownerHeroId, ownerHeroId), eq(letters.folder, folder)))
      .orderBy(desc(letters.id));
    return rows.map(toLetter);
  }

  async countInbox(ownerHeroId: number): Promise<number> {
    requireWireIdentity(ownerHeroId, "hero id");
    const rows = await this.database
      .session()
      .select({ id: letters.id })
      .from(letters)
      .where(and(eq(letters.ownerHeroId, ownerHeroId), eq(letters.folder, MAIL_FOLDER_INBOX)));
    return rows.length;
  }

  async load(id: number, ownerHeroId: number): Promise<Letter | null> {
    requireWireIdentity(id, "letter id");
    requireWireIdentity(ownerHeroId, "hero id");
    const rows = await this.database
      .session()
      .select()
      .from(letters)
      .where(and(eq(letters.id, id), eq(letters.ownerHeroId, ownerHeroId)));
    if (rows.length > 1) throw new Error(`Multiple mail rows for letter ${id}`);
    const row = rows[0];
    if (!row) return null;
    return toLetter(row);
  }

  async delete(id: number): Promise<void> {
    requireWireIdentity(id, "letter id");
    const deleted = await this.database
      .session()
      .delete(letters)
      .where(eq(letters.id, id))
      .returning({ id: letters.id });
    if (deleted.length !== 1) throw new Error(`Letter ${id} delete missed the row`);
  }

  async hasUnreadInbox(ownerHeroId: number): Promise<boolean> {
    requireWireIdentity(ownerHeroId, "hero id");
    const rows = await this.database
      .session()
      .select({ id: letters.id })
      .from(letters)
      .where(
        and(
          eq(letters.ownerHeroId, ownerHeroId),
          eq(letters.folder, MAIL_FOLDER_INBOX),
          sql`(${letters.flags} & ${MAIL_FLAG_READ}) = 0`,
        ),
      )
      .limit(1);
    return rows.length > 0;
  }
}

function toLetter(row: typeof letters.$inferSelect): Letter {
  const moneyType = row.moneyType;
  if (moneyType !== 0 && moneyType !== 1) {
    throw new Error(`Letter ${row.id} money_type ${moneyType} is invalid`);
  }
  const system = row.system;
  if (system !== 0 && system !== 1) {
    throw new Error(`Letter ${row.id} system ${system} is invalid`);
  }
  const folder = row.folder;
  if (folder !== "inbox" && folder !== "outbox") {
    throw new Error(`Letter ${row.id} folder ${folder} is invalid`);
  }
  return {
    id: requireWireIdentity(row.id, "letter id"),
    ownerHeroId: requireWireIdentity(row.ownerHeroId, "owner hero id"),
    folder,
    peerHeroId:
      row.peerHeroId === null ? null : requireWireIdentity(row.peerHeroId, "peer hero id"),
    peerNick: row.peerNick,
    subject: row.subject,
    body: row.body,
    sentAt: requireTimestamp(row.sentAt, `letter ${row.id} sent_at`),
    expiresAt: requireTimestamp(row.expiresAt, `letter ${row.id} expires_at`),
    flags: row.flags,
    moneyComeMinor: safeInteger(row.moneyComeMinor, `letter ${row.id} money_come`),
    paymentMinor: safeInteger(row.paymentMinor, `letter ${row.id} payment`),
    taxMinor: safeInteger(row.taxMinor, `letter ${row.id} tax`),
    moneyType,
    pairId: row.pairId === null ? null : requireWireIdentity(row.pairId, "pair id"),
    system,
  };
}

function requireTimestamp(value: Date, label: string): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function safeInteger(value: bigint, label: string): number {
  const converted = Number(value);
  if (!Number.isSafeInteger(converted) || converted < 0) throw new Error(`Unsafe ${label}`);
  return converted;
}
