import type { ChatDesk } from "../../../../app/chat-desk.ts";
import { ChatDeniedError } from "../../../chat/domain/chat-denied-error.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class ChatAddCommand implements OaCommand {
  static readonly key = "chat|add";
  readonly key = ChatAddCommand.key;

  constructor(
    private readonly chat: ChatDesk,
    private readonly bootstrap: BootstrapReadModel,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      const result = await this.chat.add(accountId, envelope.form);
      return {
        kind: "flat",
        blocks: {
          "chat|add": { status: 100 },
          "chat|message": result.echo,
          state: await this.bootstrap.state(accountId),
        },
      };
    } catch (error) {
      if (error instanceof ChatDeniedError && error.status === 2) {
        return { kind: "nested", value: { status: 2, error: error.message } };
      }
      if (error instanceof ChatDeniedError) throw new ProtocolError(203, error.message);
      throw error;
    }
  }
}
