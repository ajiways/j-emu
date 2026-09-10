import type { LetterAttachment } from "./letter-attachment.ts";
import { MAIL_FLAG_COD } from "./mail-flags.ts";

export function letterMoneyType(input: {
  flags: number;
  moneyComeMinor: number;
  paymentMinor: number;
  taxMinor: number;
  attachments: readonly LetterAttachment[];
}): 0 | 1 {
  const goldUi =
    (input.flags & MAIL_FLAG_COD) !== 0 ||
    input.moneyComeMinor > 0 ||
    input.paymentMinor > 0 ||
    input.taxMinor > 0 ||
    input.attachments.length > 0;
  return goldUi ? 1 : 0;
}
