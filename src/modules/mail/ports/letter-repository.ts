import type { Letter, NewLetter } from "../domain/letter.ts";
import type { MailFolder } from "../domain/mail-folder.ts";

export interface LetterRepository {
  insert(row: NewLetter): Promise<Letter>;
  setPairId(id: number, pairId: number): Promise<void>;
  listFolder(ownerHeroId: number, folder: MailFolder): Promise<readonly Letter[]>;
  countInbox(ownerHeroId: number): Promise<number>;
  load(id: number, ownerHeroId: number): Promise<Letter | null>;
  lock(id: number, ownerHeroId: number): Promise<Letter | null>;
  lockExpired(now: Date): Promise<readonly Letter[]>;
  markPicked(letter: Letter): Promise<void>;
  delete(id: number): Promise<void>;
  hasUnreadInbox(ownerHeroId: number): Promise<boolean>;
}
