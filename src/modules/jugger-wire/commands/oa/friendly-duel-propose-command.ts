import { ProtocolError } from "../../application/protocol-error.ts";
import type { ProposeFriendlyDuel } from "../../application/propose-friendly-duel.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class FriendlyDuelProposeCommand implements OaCommand {
  static readonly key = "user|friendly_duel_propose";
  readonly key = FriendlyDuelProposeCommand.key;

  constructor(private readonly propose: ProposeFriendlyDuel) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    const nick = envelope.form?.["nick"];
    if (typeof nick !== "string") throw new ProtocolError(203, "ник не указан");
    await this.propose.execute(accountId, nick);
    return { kind: "nested", value: { status: 100 } };
  }
}
