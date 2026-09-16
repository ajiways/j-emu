import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class CommonDummyCommand implements OaCommand {
  static readonly key = "common|dummy";
  readonly key = CommonDummyCommand.key;

  async execute(): Promise<OaEncodedResponse> {
    return { kind: "nested", value: { status: 100 } };
  }
}
