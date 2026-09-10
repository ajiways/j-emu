import type { Clock } from "../../../shared/kernel/clock.ts";
import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import type { LetterAttachment } from "../domain/letter-attachment.ts";
import type { Letter } from "../domain/letter.ts";
import { letterHasValuables } from "../domain/letter-valuables.ts";
import { MAIL_FOLDER_INBOX, MAIL_FOLDER_OUTBOX, type MailFolder } from "../domain/mail-folder.ts";
import { MailDeniedError } from "../domain/mail-denied-error.ts";
import { MAIL_FLAG_RETURN } from "../domain/mail-flags.ts";
import { TTL_INBOX_SEC } from "../domain/mail-ttl.ts";
import { isPendingCodInbox } from "../domain/pending-cod.ts";
import { expireAt, playerLetter } from "../domain/player-letter.ts";
import { WELCOME_LETTER } from "../domain/welcome-letter.ts";
import type { LetterRepository } from "../ports/letter-repository.ts";
import type { UnreadMailQuery } from "../ports/unread-mail.ts";

export type PlayerLetterPair = Readonly<{
  fromHeroId: number;
  fromNick: string;
  toHeroId: number;
  toNick: string;
  subject: string;
  text: string;
  flags: number;
  moneyComeMinor: number;
  paymentMinor: number;
  taxMinor: number;
  attachments: readonly LetterAttachment[];
  ttlInboxSec: number;
  ttlOutboxSec: number;
}>;

export type SystemInboxCommand = Readonly<{
  toHeroId: number;
  fromNick: string;
  fromHeroId: number | null;
  subject: string;
  text: string;
  flags: number;
  moneyComeMinor: number;
  attachments: readonly LetterAttachment[];
}>;

type MailHeroQuery = Readonly<{
  getById(id: number): Promise<{ id: number; nick: string } | null>;
}>;

export class MailService implements UnreadMailQuery {
  constructor(
    private readonly letters: LetterRepository,
    private readonly clock: Clock,
    private readonly unitOfWork: UnitOfWork,
    private readonly heroes: MailHeroQuery,
  ) {}

  async listInbox(heroId: number): Promise<readonly Letter[]> {
    requireWireIdentity(heroId, "hero id");
    return this.unitOfWork.run(async () => {
      await this.sweepExpiredUnlocked();
      await this.ensureWelcome(heroId);
      return this.letters.listFolder(heroId, MAIL_FOLDER_INBOX);
    });
  }

  async list(heroId: number, folder: MailFolder): Promise<readonly Letter[]> {
    requireWireIdentity(heroId, "hero id");
    return this.unitOfWork.run(async () => {
      await this.sweepExpiredUnlocked();
      return this.letters.listFolder(heroId, folder);
    });
  }

  async listOutbox(heroId: number): Promise<readonly Letter[]> {
    return this.list(heroId, MAIL_FOLDER_OUTBOX);
  }

  async delete(heroId: number, letterId: number): Promise<MailFolder> {
    requireWireIdentity(heroId, "hero id");
    requireWireIdentity(letterId, "letter id");
    return this.unitOfWork.run(async () => {
      await this.sweepExpiredUnlocked();
      const letter = await this.letters.lock(letterId, heroId);
      if (!letter) throw new MailDeniedError("письмо не найдено");
      if (letterHasValuables(letter)) throw new MailDeniedError("сначала заберите ценности");
      await this.letters.delete(letter.id);
      return letter.folder;
    });
  }

  async hasUnread(heroId: number): Promise<boolean> {
    requireWireIdentity(heroId, "hero id");
    return this.letters.hasUnreadInbox(heroId);
  }

  async inboxCount(heroId: number): Promise<number> {
    requireWireIdentity(heroId, "hero id");
    return this.letters.countInbox(heroId);
  }

  async lockInbox(heroId: number, letterId: number): Promise<Letter | null> {
    requireWireIdentity(heroId, "hero id");
    requireWireIdentity(letterId, "letter id");
    const letter = await this.letters.lock(letterId, heroId);
    if (!letter || letter.folder !== MAIL_FOLDER_INBOX) return null;
    return letter;
  }

  async markPicked(letter: Letter): Promise<void> {
    await this.letters.markPicked(letter);
  }

  async remove(letterId: number): Promise<void> {
    requireWireIdentity(letterId, "letter id");
    await this.letters.delete(letterId);
  }

  async sweepExpired(): Promise<void> {
    await this.unitOfWork.run(() => this.sweepExpiredUnlocked());
  }

  async deliverPlayerPair(command: PlayerLetterPair): Promise<void> {
    requireWireIdentity(command.fromHeroId, "from hero id");
    requireWireIdentity(command.toHeroId, "to hero id");
    if (!command.fromNick) throw new Error("Sender nick is required");
    if (!command.toNick) throw new Error("Recipient nick is required");
    const sentAt = this.clock.now();
    const inbox = await this.letters.insert(
      playerLetter({
        ownerHeroId: command.toHeroId,
        folder: MAIL_FOLDER_INBOX,
        peerHeroId: command.fromHeroId,
        peerNick: command.fromNick,
        subject: command.subject,
        text: command.text,
        sentAt,
        ttlSec: command.ttlInboxSec,
        flags: command.flags,
        moneyComeMinor: command.moneyComeMinor,
        paymentMinor: command.paymentMinor,
        taxMinor: command.taxMinor,
        attachments: command.attachments,
      }),
    );
    await this.letters.insert(
      playerLetter({
        ownerHeroId: command.fromHeroId,
        folder: MAIL_FOLDER_OUTBOX,
        peerHeroId: command.toHeroId,
        peerNick: command.toNick,
        subject: command.subject,
        text: command.text,
        sentAt,
        ttlSec: command.ttlOutboxSec,
        flags: command.flags,
        moneyComeMinor: command.moneyComeMinor,
        paymentMinor: command.paymentMinor,
        taxMinor: command.taxMinor,
        attachments: command.attachments,
        pairId: inbox.id,
      }),
    );
    await this.letters.setPairId(inbox.id, inbox.id);
  }

  async deliverSystemInbox(command: SystemInboxCommand): Promise<void> {
    requireWireIdentity(command.toHeroId, "to hero id");
    if (!command.fromNick) throw new Error("System mail sender nick is required");
    const sentAt = this.clock.now();
    await this.letters.insert({
      ownerHeroId: command.toHeroId,
      folder: MAIL_FOLDER_INBOX,
      peerHeroId: command.fromHeroId,
      peerNick: command.fromNick,
      subject: command.subject,
      body: command.text,
      sentAt,
      expiresAt: expireAt(sentAt, TTL_INBOX_SEC),
      flags: command.flags,
      moneyComeMinor: command.moneyComeMinor,
      paymentMinor: 0,
      taxMinor: 0,
      moneyType: command.moneyComeMinor > 0 || command.attachments.length > 0 ? 1 : 0,
      pairId: null,
      system: 1,
      attachments: command.attachments,
    });
  }

  async returnCodInbox(letter: Letter, fromNick: string, fromHeroId: number): Promise<void> {
    if (!isPendingCodInbox(letter))
      throw new MailDeniedError("вернуть можно только наложенный платёж");
    const senderId = letter.peerHeroId;
    if (senderId === null) throw new Error(`COD letter ${letter.id} has no sender`);
    if (letter.attachments.length < 1) throw new MailDeniedError("нечего возвращать");
    requireWireIdentity(fromHeroId, "from hero id");
    if (!fromNick) throw new Error("COD return nick is required");
    await this.deliverSystemInbox({
      toHeroId: senderId,
      fromNick,
      fromHeroId,
      subject: "Возврат наложенного платежа",
      text: letter.subject,
      flags: MAIL_FLAG_RETURN,
      moneyComeMinor: 0,
      attachments: letter.attachments,
    });
    await this.letters.delete(letter.id);
  }

  private async sweepExpiredUnlocked(): Promise<void> {
    const expired = await this.letters.lockExpired(this.clock.now());
    for (const letter of expired) {
      if (isPendingCodInbox(letter)) {
        const owner = await this.heroes.getById(letter.ownerHeroId);
        if (!owner) {
          throw new Error(`Hero ${letter.ownerHeroId} is missing for COD expiry`);
        }
        await this.returnCodInbox(letter, owner.nick, owner.id);
        continue;
      }
      await this.letters.delete(letter.id);
    }
  }

  private async ensureWelcome(heroId: number): Promise<void> {
    if ((await this.letters.countInbox(heroId)) > 0) return;
    const sentAt = this.clock.now();
    await this.letters.insert({
      ownerHeroId: heroId,
      folder: MAIL_FOLDER_INBOX,
      peerHeroId: null,
      peerNick: WELCOME_LETTER.fromNick,
      subject: WELCOME_LETTER.subject,
      body: WELCOME_LETTER.text,
      sentAt,
      expiresAt: expireAt(sentAt, TTL_INBOX_SEC),
      flags: 0,
      moneyComeMinor: 0,
      paymentMinor: 0,
      taxMinor: 0,
      moneyType: 0,
      pairId: null,
      system: 1,
      attachments: [],
    });
  }
}
