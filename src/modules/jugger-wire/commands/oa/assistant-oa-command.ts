import type { AssistantDesk } from "../../../../app/assistant-desk.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export const ASSISTANT_OA_KEYS = [
  "assistant|info",
  "assistant|farm_info",
  "assistant|work",
  "assistant|repeat",
  "assistant|revoke",
  "assistant|save",
  "assistant|create",
  "assistant|upgrade",
] as const;

export class AssistantOaCommand implements OaCommand {
  constructor(
    readonly key: string,
    private readonly desk: AssistantDesk,
  ) {}

  execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    return this.desk.execute(this.key, accountId, envelope);
  }
}
