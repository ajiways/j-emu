import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class UserSkillsCommand implements OaCommand {
  static readonly key = "user|skills";
  readonly key = UserSkillsCommand.key;

  constructor(private readonly bootstrap: BootstrapReadModel) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    return { kind: "nested", value: await this.bootstrap.skills(accountId) };
  }
}
