import type { LetterAttachment } from "./letter-attachment.ts";
import { letterMoneyType } from "./letter-money-type.ts";
import type { NewLetter } from "./letter.ts";
import type { MailFolder } from "./mail-folder.ts";

export function expireAt(sentAt: Date, ttlSec: number): Date {
  if (!Number.isInteger(ttlSec) || ttlSec < 1) throw new Error("Mail TTL is invalid");
  return new Date(sentAt.getTime() + ttlSec * 1000);
}

export function playerLetter(input: {
  ownerHeroId: number;
  folder: MailFolder;
  peerHeroId: number;
  peerNick: string;
  subject: string;
  text: string;
  sentAt: Date;
  ttlSec: number;
  flags?: number;
  moneyComeMinor?: number;
  paymentMinor?: number;
  taxMinor?: number;
  attachments?: readonly LetterAttachment[];
  pairId?: number;
  system?: 0 | 1;
}): NewLetter {
  const flags = input.flags === undefined ? 0 : input.flags;
  const moneyComeMinor = input.moneyComeMinor === undefined ? 0 : input.moneyComeMinor;
  const paymentMinor = input.paymentMinor === undefined ? 0 : input.paymentMinor;
  const taxMinor = input.taxMinor === undefined ? 0 : input.taxMinor;
  const attachments = input.attachments === undefined ? [] : input.attachments;
  return {
    ownerHeroId: input.ownerHeroId,
    folder: input.folder,
    peerHeroId: input.peerHeroId,
    peerNick: input.peerNick,
    subject: input.subject,
    body: input.text,
    sentAt: input.sentAt,
    expiresAt: expireAt(input.sentAt, input.ttlSec),
    flags,
    moneyComeMinor,
    paymentMinor,
    taxMinor,
    moneyType: letterMoneyType({
      flags,
      moneyComeMinor,
      paymentMinor,
      taxMinor,
      attachments,
    }),
    pairId: input.pairId === undefined ? null : input.pairId,
    system: input.system === undefined ? 0 : input.system,
    attachments,
  };
}
