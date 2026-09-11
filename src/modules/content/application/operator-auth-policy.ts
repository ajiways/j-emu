import { createHash, timingSafeEqual } from "node:crypto";

export class OperatorAuthPolicy {
  constructor(private readonly token: string) {
    if (!token) throw new Error("CONTENT_OPERATOR_TOKEN is required");
  }

  matches(authorizationHeader: string | undefined): boolean {
    if (authorizationHeader === undefined) return false;
    const prefix = "Bearer ";
    if (!authorizationHeader.startsWith(prefix)) return false;
    const presented = authorizationHeader.slice(prefix.length);
    const left = createHash("sha256").update(presented).digest();
    const right = createHash("sha256").update(this.token).digest();
    return timingSafeEqual(left, right);
  }
}
