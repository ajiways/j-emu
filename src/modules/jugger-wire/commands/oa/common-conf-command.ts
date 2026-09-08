import type { BootstrapReadModel, HeroStateBlock } from "../../application/bootstrap-read-model.ts";
import type { CommonConfBlock } from "../../../content/domain/bootstrap-content.ts";
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
    const blocks: CommonConfBlocks = {
      "common|conf": await this.bootstrap.commonConf(),
      state: await this.bootstrap.state(accountId),
    };
    return { kind: "flat", blocks };
  }
}
