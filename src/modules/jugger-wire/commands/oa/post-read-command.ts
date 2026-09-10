import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class PostReadCommand implements OaCommand {
  static readonly key = "post|read";
  readonly key = PostReadCommand.key;

  async execute(): Promise<OaEncodedResponse> {
    return { kind: "nested", value: { status: 100 } };
  }
}
