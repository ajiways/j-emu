import type { Clock } from "../../../shared/kernel/clock.ts";
import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";

const INVITE_TTL_MS = 60_000;

export type FriendlyDuelInvite = Readonly<{
  fromAccountId: number;
  fromNick: string;
  toAccountId: number;
  toNick: string;
  createdAtMs: number;
}>;

export class FriendlyDuelInvites {
  private readonly pendingByTarget = new Map<number, FriendlyDuelInvite>();

  constructor(private readonly clock: Clock) {}

  put(invite: FriendlyDuelInvite): void {
    requireWireIdentity(invite.fromAccountId, "challenger account id");
    requireWireIdentity(invite.toAccountId, "target account id");
    if (!invite.fromNick) throw new Error("Challenger nick is required");
    if (!invite.toNick) throw new Error("Target nick is required");
    this.prune();
    this.pendingByTarget.set(invite.toAccountId, invite);
  }

  take(targetAccountId: number): FriendlyDuelInvite | null {
    requireWireIdentity(targetAccountId, "target account id");
    this.prune();
    const invite = this.pendingByTarget.get(targetAccountId);
    if (!invite) return null;
    this.pendingByTarget.delete(targetAccountId);
    return invite;
  }

  private prune(): void {
    const now = this.clock.now().getTime();
    for (const [accountId, invite] of this.pendingByTarget) {
      if (now - invite.createdAtMs > INVITE_TTL_MS) this.pendingByTarget.delete(accountId);
    }
  }
}
