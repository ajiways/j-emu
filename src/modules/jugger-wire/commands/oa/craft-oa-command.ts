import type { CraftDesk } from "../../../../app/craft-desk.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export const CRAFT_OA_KEYS = [
  "craft|user_recipes_list",
  "craft|craft_items",
  "craft|recipe_add_favorite",
  "craft|recipe_remove_favorite",
] as const;

export class CraftOaCommand implements OaCommand {
  constructor(
    readonly key: string,
    private readonly desk: CraftDesk,
  ) {}

  execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    return this.desk.execute(this.key, accountId, envelope);
  }
}
