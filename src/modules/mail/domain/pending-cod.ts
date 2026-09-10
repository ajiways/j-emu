import type { Letter } from "./letter.ts";
import { MAIL_FOLDER_INBOX } from "./mail-folder.ts";
import { MAIL_FLAG_COD } from "./mail-flags.ts";

export function isPendingCodInbox(letter: Letter): boolean {
  return (
    letter.folder === MAIL_FOLDER_INBOX &&
    (letter.flags & MAIL_FLAG_COD) !== 0 &&
    letter.attachments.length > 0
  );
}
