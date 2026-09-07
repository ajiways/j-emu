import type { Account } from "../domain/account.ts";

export interface AccountRepository {
  findById(id: number): Promise<Account | null>;
  findByLogin(login: string): Promise<Account | null>;
  create(login: string, nick: string, passwordHash: string | null): Promise<Account>;
  save(account: Account): Promise<void>;
}
