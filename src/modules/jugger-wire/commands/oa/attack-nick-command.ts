import { ProtocolError } from "../../application/protocol-error.ts";
import type { BattlegroundDesk } from "../../../../app/battleground-desk.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class AttackNickCommand implements OaCommand {
  static readonly key = "common|object:ATTACK";
  readonly key = AttackNickCommand.key;

  constructor(private readonly desk: BattlegroundDesk) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    const nick = envelope.form?.["nick"] ?? envelope.input?.["nick"];
    if (typeof nick !== "string") throw new ProtocolError(203, "укажите ник");
    return { kind: "flat", blocks: await this.desk.attack(accountId, nick) };
  }
}
