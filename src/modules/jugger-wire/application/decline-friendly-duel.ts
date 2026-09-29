import { ProtocolError } from "./protocol-error.ts";
import type { FriendlyDuelInvites } from "./friendly-duel-invites.ts";

export class DeclineFriendlyDuel {
  constructor(private readonly invites: FriendlyDuelInvites) {}

  execute(accountId: number, challengerNick: string): void {
    const invite = this.invites.take(accountId);
    if (!invite) throw new ProtocolError(203, "вызов устарел");
    const nick = challengerNick.trim();
    if (!nick || invite.fromNick.toLowerCase() !== nick.toLowerCase()) {
      throw new ProtocolError(203, "вызов от другого игрока");
    }
  }
}
