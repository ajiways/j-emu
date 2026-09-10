import { ProtocolError } from "../../application/protocol-error.ts";
import type { AcceptFriendlyDuel } from "../../application/accept-friendly-duel.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class FriendlyDuelAcceptCommand implements OaCommand {
  static readonly key = "user|friendly_duel_accept";
  readonly key = FriendlyDuelAcceptCommand.key;

  constructor(private readonly accept: AcceptFriendlyDuel) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    const nick = envelope.form?.["nick"];
    if (nick !== undefined && typeof nick !== "string") {
      throw new ProtocolError(203, "ник не указан");
    }
    return { kind: "flat", blocks: await this.accept.execute(accountId, nick ?? "") };
  }
}
