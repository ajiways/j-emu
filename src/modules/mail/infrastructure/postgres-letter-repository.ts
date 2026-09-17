import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { requireItemInstanceData } from "../../inventory/domain/item-instance-data.ts";
import type { LetterAttachment } from "../domain/letter-attachment.ts";
import type { Letter, NewLetter } from "../domain/letter.ts";
import { MAIL_FOLDER_INBOX, type MailFolder } from "../domain/mail-folder.ts";
import { MAIL_FLAG_COD, MAIL_FLAG_READ } from "../domain/mail-flags.ts";
import type { LetterRepository } from "../ports/letter-repository.ts";
import { letterAttachments, letters } from "./schema.ts";

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
    await this.insertAttachments(created.id, row.attachments);
    return { ...toLetter(created), attachments: row.attachments };
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
    return this.withAttachments(rows);
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
    return this.loadWhere(id, ownerHeroId, false);
  }

  async lock(id: number, ownerHeroId: number): Promise<Letter | null> {
    return this.loadWhere(id, ownerHeroId, true);
  }

  async lockExpired(now: Date): Promise<readonly Letter[]> {
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
      throw new Error("Mail sweep timestamp is invalid");
    }
    const rows = await this.database
      .session()
      .select()
      .from(letters)
      .where(lte(letters.expiresAt, now))
      .orderBy(letters.id)
      .for("update");
    return this.withAttachments(rows);
  }

  async markPicked(letter: Letter): Promise<void> {
    requireWireIdentity(letter.id, "letter id");
    const updated = await this.database
      .session()
      .update(letters)
      .set({
        moneyComeMinor: 0n,
        paymentMinor: 0n,
        taxMinor: 0n,
        moneyType: 0,
        flags: (letter.flags & ~MAIL_FLAG_COD) | MAIL_FLAG_READ,
      })
      .where(eq(letters.id, letter.id))
      .returning({ id: letters.id });
    if (updated.length !== 1) throw new Error(`Letter ${letter.id} markPicked missed the row`);
    await this.database
      .session()
      .delete(letterAttachments)
      .where(eq(letterAttachments.letterId, letter.id));
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

  private async loadWhere(id: number, ownerHeroId: number, lock: boolean): Promise<Letter | null> {
    requireWireIdentity(id, "letter id");
    requireWireIdentity(ownerHeroId, "hero id");
    const query = this.database
      .session()
      .select()
      .from(letters)
      .where(and(eq(letters.id, id), eq(letters.ownerHeroId, ownerHeroId)));
    const rows = lock ? await query.for("update") : await query;
    if (rows.length > 1) throw new Error(`Multiple mail rows for letter ${id}`);
    const row = rows[0];
    if (!row) return null;
    const [letter] = await this.withAttachments([row]);
    if (!letter) throw new Error(`Letter ${id} attachment load missed the row`);
    return letter;
  }

  private async insertAttachments(
    letterId: number,
    attachments: readonly LetterAttachment[],
  ): Promise<void> {
    if (attachments.length < 1) return;
    await this.database
      .session()
      .insert(letterAttachments)
      .values(
        attachments.map((attachment, ord) => ({
          letterId,
          ord,
          originalItemId: attachment.originalItemId,
          artifactId: attachment.artifactId,
          quantity: attachment.quantity,
          durability: attachment.durability,
          durabilityMax: attachment.durabilityMax,
          upgradeId: attachment.upgradeId,
          upgradeLevel: attachment.upgradeLevel,
          upgradeSkillId: attachment.upgradeSkillId,
          upgradeBound: attachment.upgradeBound,
          dataJson: attachment.data,
        })),
      );
  }

  private async withAttachments(rows: readonly (typeof letters.$inferSelect)[]): Promise<Letter[]> {
    if (rows.length < 1) return [];
    const ids = rows.map((row) => row.id);
    const snaps = await this.database
      .session()
      .select()
      .from(letterAttachments)
      .where(inArray(letterAttachments.letterId, ids))
      .orderBy(letterAttachments.letterId, letterAttachments.ord);
    const byLetter = new Map<number, LetterAttachment[]>();
    for (const snap of snaps) {
      const list = byLetter.get(snap.letterId);
      const mapped = toAttachment(snap);
      if (list) list.push(mapped);
      else byLetter.set(snap.letterId, [mapped]);
    }
    return rows.map((row) => {
      const attachments = byLetter.get(row.id);
      return { ...toLetter(row), attachments: attachments === undefined ? [] : attachments };
    });
  }
}

function toLetter(row: typeof letters.$inferSelect): Omit<Letter, "attachments"> {
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

function toAttachment(row: typeof letterAttachments.$inferSelect): LetterAttachment {
  const upgradeBound = row.upgradeBound;
  if (upgradeBound !== 0 && upgradeBound !== 1) {
    throw new Error(`Letter ${row.letterId} attachment upgrade_bound is invalid`);
  }
  return {
    originalItemId: requireWireIdentity(row.originalItemId, "original item id"),
    artifactId: requireWireIdentity(row.artifactId, "artifact id"),
    quantity: row.quantity,
    durability: row.durability,
    durabilityMax: row.durabilityMax,
    upgradeId: row.upgradeId,
    upgradeLevel: row.upgradeLevel,
    upgradeSkillId: row.upgradeSkillId,
    upgradeBound,
    data: requireItemInstanceData(
      row.dataJson,
      `letter ${row.letterId} attachment ${row.originalItemId} data_json`,
    ),
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
