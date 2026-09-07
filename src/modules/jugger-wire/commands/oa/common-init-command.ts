import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class CommonInitCommand implements OaCommand {
  static readonly key = "common|init";
  readonly key = CommonInitCommand.key;

  constructor(private readonly bootstrap: BootstrapReadModel) {}

  async execute(accountId: string): Promise<OaEncodedResponse> {
    return { kind: "flat", blocks: await this.bootstrap.init(accountId) };
  }
}
