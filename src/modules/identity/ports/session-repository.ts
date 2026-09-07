import type { Session } from "../domain/session.ts";

export interface SessionRepository {
  findById(id: string): Promise<Session | null>;
  replaceForAccount(session: Session): Promise<void>;
  removeForAccount(accountId: number): Promise<void>;
}
