import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { flatBlockWithState } from "./flat-block-with-state.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class UserBagCommand implements OaCommand {
  static readonly key = "user|bag";
  readonly key = UserBagCommand.key;

  constructor(private readonly bootstrap: BootstrapReadModel) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    return flatBlockWithState(
      this.bootstrap,
      accountId,
      this.key,
      await this.bootstrap.bag(accountId),
    );
  }
}
