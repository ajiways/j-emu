import { BattlegroundDeniedError } from "../../../battleground/domain/battleground-denied-error.ts";
import type { BattlegroundDesk } from "../../../../app/battleground-desk.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export const ARENA_OA_KEYS = [
  "arena|list",
  "arena|bg",
  "arena|bg_request",
  "arena|bg_running",
  "arena|bg_finished",
  "arena|great_fights",
  "arena|leader_rating",
] as const;

export class ArenaOaCommand implements OaCommand {
  constructor(
    readonly key: string,
    private readonly desk: BattlegroundDesk,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      return await this.desk.execute(this.key, accountId, envelope);
    } catch (error) {
      if (error instanceof BattlegroundDeniedError) {
        return { kind: "nested", value: { status: 2, error: error.message } };
      }
      throw error;
    }
  }
}
