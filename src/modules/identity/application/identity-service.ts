import type { Clock } from "../../../shared/kernel/clock.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import type { Account } from "../domain/account.ts";
import { DuplicateAccountError } from "../domain/duplicate-account-error.ts";
import type { PasswordHasher } from "../domain/password-hasher.ts";
import { RegistrationCredentials } from "../domain/registration-credentials.ts";
import { Session } from "../domain/session.ts";
import type { AccountRepository } from "../ports/account-repository.ts";
import type { SessionPresence } from "../ports/session-presence.ts";
import type { SessionRepository } from "../ports/session-repository.ts";

export type AuthenticatedSession = Readonly<{
  account: Account;
  session: Session;
}>;

export type EstablishedSession = AuthenticatedSession &
  Readonly<{
    replacedExisting: boolean;
  }>;

export class IdentityService implements SessionPresence {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly sessions: SessionRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
    private readonly passwords: PasswordHasher,
  ) {}

  async register(login: unknown, nick: unknown, password: unknown): Promise<EstablishedSession> {
    const credentials = RegistrationCredentials.parse(login, nick, password);
    return this.unitOfWork.run(async () => {
      if (await this.accounts.findByLogin(credentials.login)) {
        throw new DuplicateAccountError("login");
      }
      if (await this.accounts.findByNick(credentials.nick)) {
        throw new DuplicateAccountError("nick");
      }
      const passwordHash = await this.passwords.hash(credentials.password);
      const account = await this.accounts.create(credentials.login, credentials.nick, passwordHash);
      const session = Session.create(account.id, this.clock.now());
      await this.sessions.replaceForAccount(session);
      return { account, session, replacedExisting: false };
    });
  }

  async login(login: string, password: string): Promise<EstablishedSession | null> {
    const account = await this.accounts.findByLogin(login.trim().toLowerCase());
    if (!account?.passwordHash || !(await this.passwords.verify(password, account.passwordHash))) {
      return null;
    }
    const existing = await this.sessions.findByAccountId(account.id);
    const session = Session.create(account.id, this.clock.now());
    await this.sessions.replaceForAccount(session);
    return { account, session, replacedExisting: existing !== null };
  }

  async createDevelopmentIdentity(slot: number): Promise<EstablishedSession> {
    if (!Number.isInteger(slot) || slot < 1) {
      throw new Error("Development slot must be a positive integer");
    }
    return this.unitOfWork.run(async () => {
      const login = `dev:${slot}`;
      let account = await this.accounts.findByLogin(login);
      if (!account) {
        account = await this.accounts.create(login, `Player${slot + 1}`, null);
      }
      const existing = await this.sessions.findByAccountId(account.id);
      const session = Session.create(account.id, this.clock.now());
      await this.sessions.replaceForAccount(session);
      return { account, session, replacedExisting: existing !== null };
    });
  }

  listAccountIdsWithSession(): Promise<readonly number[]> {
    return this.sessions.listAccountIds();
  }

  async sessionById(sessionId: string): Promise<AuthenticatedSession | null> {
    const session = await this.sessions.findById(sessionId);
    if (!session) return null;
    const account = await this.accounts.findById(session.accountId);
    if (!account) throw new Error(`Session ${sessionId} has no account`);
    return { account, session };
  }

  async authenticate(sessionId: string | undefined): Promise<Account | null> {
    if (!sessionId) return null;
    const found = await this.sessionById(sessionId);
    return found?.account ?? null;
  }

  async logout(sessionId: string | undefined): Promise<number | null> {
    if (!sessionId) return null;
    const session = await this.sessions.findById(sessionId);
    if (!session) return null;
    await this.sessions.removeForAccount(session.accountId);
    return session.accountId;
  }
}
