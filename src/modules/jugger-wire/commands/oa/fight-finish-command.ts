import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class FightFinishCommand implements OaCommand {
  static readonly key = "fight|finish";
  readonly key = FightFinishCommand.key;

  constructor(private readonly bootstrap: BootstrapReadModel) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    return {
      kind: "flat",
      blocks: {
        "fight|finish": { status: 100 },
        "fight|conf": { expire: 0 },
        "user|view": await this.bootstrap.view(accountId),
        state: await this.bootstrap.state(accountId),
      },
    };
  }
}
