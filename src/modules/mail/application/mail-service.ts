import type { Clock } from "../../../shared/kernel/clock.ts";
import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { Letter, NewLetter } from "../domain/letter.ts";
import { letterHasValuables } from "../domain/letter-valuables.ts";
import { MAIL_FOLDER_INBOX, MAIL_FOLDER_OUTBOX, type MailFolder } from "../domain/mail-folder.ts";
import { MailDeniedError } from "../domain/mail-denied-error.ts";
import { TTL_INBOX_SEC, TTL_OUTBOX_SEC } from "../domain/mail-ttl.ts";
import { WELCOME_LETTER } from "../domain/welcome-letter.ts";
import type { LetterRepository } from "../ports/letter-repository.ts";
import type { UnreadMailQuery } from "../ports/unread-mail.ts";

type PlayerLetterPair = Readonly<{
  fromHeroId: number;
  fromNick: string;
  toHeroId: number;
  toNick: string;
  subject: string;
  text: string;
}>;

export class MailService implements UnreadMailQuery {
  constructor(
    private readonly letters: LetterRepository,
    private readonly clock: Clock,
  ) {}

  async listInbox(heroId: number): Promise<readonly Letter[]> {
    requireWireIdentity(heroId, "hero id");
    await this.ensureWelcome(heroId);
    return this.letters.listFolder(heroId, MAIL_FOLDER_INBOX);
  }

  async list(heroId: number, folder: MailFolder): Promise<readonly Letter[]> {
    requireWireIdentity(heroId, "hero id");
    return this.letters.listFolder(heroId, folder);
  }

  async listOutbox(heroId: number): Promise<readonly Letter[]> {
    return this.list(heroId, MAIL_FOLDER_OUTBOX);
  }

  async delete(heroId: number, letterId: number): Promise<MailFolder> {
    requireWireIdentity(heroId, "hero id");
    requireWireIdentity(letterId, "letter id");
    const letter = await this.letters.load(letterId, heroId);
    if (!letter) throw new MailDeniedError("письмо не найдено");
    if (letterHasValuables(letter)) throw new MailDeniedError("сначала заберите ценности");
    await this.letters.delete(letter.id);
    return letter.folder;
  }

  async hasUnread(heroId: number): Promise<boolean> {
    requireWireIdentity(heroId, "hero id");
    return this.letters.hasUnreadInbox(heroId);
  }

  async inboxCount(heroId: number): Promise<number> {
    requireWireIdentity(heroId, "hero id");
    return this.letters.countInbox(heroId);
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
        ttlSec: TTL_INBOX_SEC,
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
        ttlSec: TTL_OUTBOX_SEC,
        pairId: inbox.id,
      }),
    );
    await this.letters.setPairId(inbox.id, inbox.id);
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
    });
  }
}

function playerLetter(input: {
  ownerHeroId: number;
  folder: MailFolder;
  peerHeroId: number;
  peerNick: string;
  subject: string;
  text: string;
  sentAt: Date;
  ttlSec: number;
  pairId?: number;
}): NewLetter {
  return {
    ownerHeroId: input.ownerHeroId,
    folder: input.folder,
    peerHeroId: input.peerHeroId,
    peerNick: input.peerNick,
    subject: input.subject,
    body: input.text,
    sentAt: input.sentAt,
    expiresAt: expireAt(input.sentAt, input.ttlSec),
    flags: 0,
    moneyComeMinor: 0,
    paymentMinor: 0,
    taxMinor: 0,
    moneyType: 0,
    pairId: input.pairId === undefined ? null : input.pairId,
    system: 0,
  };
}

function expireAt(sentAt: Date, ttlSec: number): Date {
  return new Date(sentAt.getTime() + ttlSec * 1000);
}
