import { randomBytes } from "node:crypto";
import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";

export class Session {
  private constructor(
    readonly id: string,
    readonly accountId: number,
    readonly sessionKey: string,
    readonly createdAt: Date,
  ) {}

  static create(accountId: number, now: Date): Session {
    return new Session(
      randomBytes(16).toString("hex"),
      requireWireIdentity(accountId, "account id"),
      randomBytes(16).toString("hex"),
      now,
    );
  }

  static restore(id: string, accountId: number, sessionKey: string, createdAt: Date): Session {
    return new Session(id, requireWireIdentity(accountId, "account id"), sessionKey, createdAt);
  }
}
