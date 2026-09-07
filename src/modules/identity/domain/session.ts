import { randomBytes } from "node:crypto";

export class Session {
  private constructor(
    readonly id: string,
    readonly accountId: string,
    readonly sessionKey: string,
    readonly createdAt: Date,
  ) {}

  static create(accountId: string, now: Date): Session {
    return new Session(
      randomBytes(16).toString("hex"),
      accountId,
      randomBytes(16).toString("hex"),
      now,
    );
  }

  static restore(id: string, accountId: string, sessionKey: string, createdAt: Date): Session {
    return new Session(id, accountId, sessionKey, createdAt);
  }
}
