import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";

export class Account {
  private constructor(
    readonly id: number,
    readonly login: string,
    readonly nick: string,
    readonly passwordHash: string | null,
  ) {}

  static credentials(
    login: string,
    nick: string,
    passwordHash: string | null,
  ): Readonly<{ login: string; nick: string; passwordHash: string | null }> {
    if (!login.trim() || !nick.trim()) throw new Error("Login and nick are required");
    return { login: login.trim().toLowerCase(), nick: nick.trim(), passwordHash };
  }

  static restore(id: number, login: string, nick: string, passwordHash: string | null): Account {
    return new Account(requireWireIdentity(id, "account id"), login, nick, passwordHash);
  }
}
