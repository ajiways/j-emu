import type { QuestDesk } from "../../../../app/quest-desk.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export const QUEST_OA_KEYS = [
  "npc|quests",
  "npc|info",
  "npc|answer",
  "book|quest_list",
  "book|quest_cancel",
  "book|quest_delete",
  "common|object:AREA",
  "common|action_finish",
] as const;

export class QuestOaCommand implements OaCommand {
  constructor(
    readonly key: string,
    private readonly desk: QuestDesk,
  ) {}

  execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    return this.desk.execute(this.key, accountId, envelope);
  }
}
