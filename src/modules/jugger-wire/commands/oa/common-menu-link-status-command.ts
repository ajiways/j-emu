import type { HeroSheetReadModel } from "../../application/hero-sheet-read-model.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class CommonMenuLinkStatusCommand implements OaCommand {
  static readonly key = "common|menu_link_status";
  readonly key = CommonMenuLinkStatusCommand.key;

  constructor(private readonly sheet: HeroSheetReadModel) {}

  async execute(): Promise<OaEncodedResponse> {
    return { kind: "nested", value: this.sheet.menuLinkStatus };
  }
}
