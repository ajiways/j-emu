import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { requireBootstrapBlock } from "../../application/require-bootstrap-block.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class UserPersonalDetailsCommand implements OaCommand {
  static readonly key = "user|personal_details";
  readonly key = UserPersonalDetailsCommand.key;

  constructor(private readonly bootstrap: BootstrapReadModel) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    const init = await this.bootstrap.init(accountId);
    return { kind: "nested", value: requireBootstrapBlock(init, "user|personal_details") };
  }
}
