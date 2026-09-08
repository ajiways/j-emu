import type { Session } from "../domain/session.ts";

export interface SessionRepository {
  findById(id: string): Promise<Session | null>;
  findByAccountId(accountId: number): Promise<Session | null>;
  listAccountIds(): Promise<readonly number[]>;
  replaceForAccount(session: Session): Promise<void>;
  removeForAccount(accountId: number): Promise<void>;
}
