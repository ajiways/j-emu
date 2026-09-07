import type { BootstrapReadModel, HeroStateBlock } from "../../application/bootstrap-read-model.ts";
import type { UserUnitframeBlock } from "../../application/user-unitframe-block.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

type UserUnitframeBlocks = Readonly<{
  "user|unitframe": UserUnitframeBlock;
  state: HeroStateBlock;
}>;

export class UserUnitframeCommand implements OaCommand {
  static readonly key = "user|unitframe";
  readonly key = UserUnitframeCommand.key;

  constructor(private readonly bootstrap: BootstrapReadModel) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    const init = await this.bootstrap.init(accountId);
    const blocks: UserUnitframeBlocks = {
      "user|unitframe": await this.bootstrap.unitframe(accountId),
      state: init.state,
    };
    return { kind: "flat", blocks };
  }
}
