import type { LetterAttachment } from "./letter-attachment.ts";
import type { MailFolder } from "./mail-folder.ts";

export type Letter = Readonly<{
  id: number;
  ownerHeroId: number;
  folder: MailFolder;
  peerHeroId: number | null;
  peerNick: string;
  subject: string;
  body: string;
  sentAt: Date;
  expiresAt: Date;
  flags: number;
  moneyComeMinor: number;
  paymentMinor: number;
  taxMinor: number;
  moneyType: 0 | 1;
  pairId: number | null;
  system: 0 | 1;
  attachments: readonly LetterAttachment[];
}>;

export type NewLetter = Omit<Letter, "id">;
