import type { Clock } from "../../../shared/kernel/clock.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import type { Account } from "../domain/account.ts";
import type { PasswordHasher } from "../domain/password-hasher.ts";
import { Session } from "../domain/session.ts";
import type { AccountRepository } from "../ports/account-repository.ts";
import type { SessionRepository } from "../ports/session-repository.ts";

export type AuthenticatedSession = Readonly<{
  account: Account;
  session: Session;
}>;

export class IdentityService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly sessions: SessionRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
    private readonly passwords: PasswordHasher,
  ) {}

  async register(login: string, nick: string, password: string): Promise<AuthenticatedSession> {
    return this.unitOfWork.run(async () => {
      if (await this.accounts.findByLogin(login.trim().toLowerCase())) {
        throw new Error("Account already exists");
      }
      const account = await this.accounts.create(login, nick, await this.passwords.hash(password));
      const session = Session.create(account.id, this.clock.now());
      await this.sessions.replaceForAccount(session);
      return { account, session };
    });
  }

  async login(login: string, password: string): Promise<AuthenticatedSession | null> {
    const account = await this.accounts.findByLogin(login.trim().toLowerCase());
    if (!account?.passwordHash || !(await this.passwords.verify(password, account.passwordHash))) {
      return null;
    }
    const session = Session.create(account.id, this.clock.now());
    await this.sessions.replaceForAccount(session);
    return { account, session };
  }

  async createDevelopmentIdentity(slot: number): Promise<AuthenticatedSession> {
    return this.unitOfWork.run(async () => {
      const login = `dev:${slot}`;
      let account = await this.accounts.findByLogin(login);
      if (!account) {
        account = await this.accounts.create(login, `Player${slot + 1}`, null);
      }
      const session = Session.create(account.id, this.clock.now());
      await this.sessions.replaceForAccount(session);
      return { account, session };
    });
  }

  async authenticate(sessionId: string | undefined): Promise<Account | null> {
    if (!sessionId) return null;
    const session = await this.sessions.findById(sessionId);
    return session ? this.accounts.findById(session.accountId) : null;
  }
}
