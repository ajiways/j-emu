import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { userBagOrderMutation } from "../../application/user-bag-order-mutation.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class UserBagOrderCommand implements OaCommand {
  static readonly key = "user|bag_order";
  readonly key = UserBagOrderCommand.key;

  constructor(private readonly bootstrap: BootstrapReadModel) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    return {
      kind: "flat",
      blocks: userBagOrderMutation(
        await this.bootstrap.bag(accountId),
        await this.bootstrap.state(accountId),
      ),
    };
  }
}
