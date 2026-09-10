import type { PartyDesk } from "../../../../app/party-desk.ts";
import { PartyDeniedError } from "../../../party/domain/party-denied-error.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export const PARTY_OA_KEYS = [
  "party|create",
  "party|invite",
  "party|confirm_invite",
  "party|decline_invite",
  "party|kick",
  "party|leave",
  "party|disband",
  "party|change_leader",
  "party|save_settings",
  "party|search_list",
  "party|join",
  "party|confirm_join",
  "party|decline_join",
  "party|members",
  "party|settings",
  "party|bag",
] as const;

export class PartyOaCommand implements OaCommand {
  constructor(
    readonly key: string,
    private readonly desk: PartyDesk,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      return await this.desk.execute(this.key, accountId, envelope);
    } catch (error) {
      if (error instanceof PartyDeniedError) {
        return { kind: "nested", value: { status: 2, error: error.message } };
      }
      throw error;
    }
  }
}
