import type { Letter, NewLetter } from "../domain/letter.ts";
import type { MailFolder } from "../domain/mail-folder.ts";

export interface LetterRepository {
  insert(row: NewLetter): Promise<Letter>;
  setPairId(id: number, pairId: number): Promise<void>;
  listFolder(ownerHeroId: number, folder: MailFolder): Promise<readonly Letter[]>;
  countInbox(ownerHeroId: number): Promise<number>;
  load(id: number, ownerHeroId: number): Promise<Letter | null>;
  delete(id: number): Promise<void>;
  hasUnreadInbox(ownerHeroId: number): Promise<boolean>;
}
