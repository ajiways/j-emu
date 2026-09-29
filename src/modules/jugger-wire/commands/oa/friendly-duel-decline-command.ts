import { ProtocolError } from "../../application/protocol-error.ts";
import type { DeclineFriendlyDuel } from "../../application/decline-friendly-duel.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class FriendlyDuelDeclineCommand implements OaCommand {
  static readonly key = "user|friendly_duel_decline";
  readonly key = FriendlyDuelDeclineCommand.key;

  constructor(private readonly decline: DeclineFriendlyDuel) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    const nick = envelope.form?.["nick"];
    if (typeof nick !== "string") throw new ProtocolError(203, "ник не указан");
    this.decline.execute(accountId, nick);
    return { kind: "nested", value: { status: 100 } };
  }
}
