export const MAIL_FOLDER_INBOX = "inbox";
export const MAIL_FOLDER_OUTBOX = "outbox";

export type MailFolder = typeof MAIL_FOLDER_INBOX | typeof MAIL_FOLDER_OUTBOX;
