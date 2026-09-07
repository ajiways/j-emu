import type { BootstrapReadModel, HeroStateBlock } from "../../application/bootstrap-read-model.ts";
import type { CommonConfBlock } from "../../application/common-conf-document.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

type CommonConfBlocks = Readonly<{
  "common|conf": CommonConfBlock;
  state: HeroStateBlock;
}>;

export class CommonConfCommand implements OaCommand {
  static readonly key = "common|conf";
  readonly key = CommonConfCommand.key;

  constructor(private readonly bootstrap: BootstrapReadModel) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    const init = await this.bootstrap.init(accountId);
    const blocks: CommonConfBlocks = {
      "common|conf": this.bootstrap.commonConf,
      state: init.state,
    };
    return { kind: "flat", blocks };
  }
}
