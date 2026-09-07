import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import type { HeroSheetReadModel } from "../../application/hero-sheet-read-model.ts";
import { flatBlockWithState } from "./flat-block-with-state.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class UserMagicCommand implements OaCommand {
  static readonly key = "user|magic";
  readonly key = UserMagicCommand.key;

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly sheet: HeroSheetReadModel,
  ) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    return flatBlockWithState(this.bootstrap, accountId, this.key, this.sheet.magic());
  }
}
