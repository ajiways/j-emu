import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class CommonInit2Command implements OaCommand {
  static readonly key = "common|init2";
  readonly key = CommonInit2Command.key;

  constructor(private readonly bootstrap: BootstrapReadModel) {}

  async execute(accountId: string): Promise<OaEncodedResponse> {
    return { kind: "flat", blocks: await this.bootstrap.init2(accountId) };
  }
}
